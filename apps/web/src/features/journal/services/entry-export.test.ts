import { expect, it } from 'bun:test';
import { SqlClient } from '@effect/sql';
import { Chunk, Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import {
  parseEntriesDocument,
  parseManifestDocument,
} from '../export-format.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import type { EntryExport, ExportEntry } from './entry-export.ts';
import { exportArchiveStream } from './export-stream.ts';
import { ZipStreamError } from './streaming-zip.ts';

const { withJournal } = journalDatabase();
const microsecondTimestampEnd = /\.\d{6}Z$/u;

const bytesOf = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const collect = (exports: EntryExport, pageSize = 2) =>
  Effect.gen(function* () {
    let count = -1;
    const first: Array<ExportEntry> = [];
    const second: Array<ExportEntry> = [];
    yield* exports.visit(
      {
        onSnapshot: () => Effect.void,
        onCount: (total) =>
          Effect.sync(() => {
            count = total;
          }),
        passes: [
          {
            before: Effect.void,
            onEntry: (entry) => Effect.sync(() => first.push(entry)),
            after: Effect.void,
          },
          {
            before: Effect.void,
            onEntry: (entry) => Effect.sync(() => second.push(entry)),
            after: Effect.void,
          },
        ],
      },
      pageSize,
    );
    return { count, first, second };
  });

it('visits meaningful days in ascending keyset pages on every pass', async () => {
  const result = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-04', 'Fourth.'));
      yield* entries.save(draft('2026-03-01', 'First.'));
      yield* entries.save(draft('2026-03-03', 'Third.'));
      yield* entries.save(draft('2026-03-02', 'Second.'));
      yield* entries.save(draft('2026-03-05', 'Fifth.'));
      return yield* collect(exports);
    }),
  );
  const expected = [
    '2026-03-01',
    '2026-03-02',
    '2026-03-03',
    '2026-03-04',
    '2026-03-05',
  ];

  expect(result.count).toBe(expected.length);
  expect(result.first.map(({ date }) => date)).toEqual(expected);
  expect(result.second.map(({ date }) => date)).toEqual(expected);
});

it('keeps a visitor compression failure tagged in the error channel', async () => {
  const failure = new ZipStreamError({
    message: 'The journal export could not be compressed.',
    cause: new Error('compression failed'),
  });
  const observed = await withJournal(({ exports }) =>
    exports
      .visit({
        onSnapshot: () => Effect.void,
        onCount: () => Effect.fail(failure),
        passes: [],
      })
      .pipe(Effect.flip),
  );

  expect(observed).toMatchObject({
    _tag: 'ZipStreamError',
    message: failure.message,
  });
});

it('leaves cleared and never-written rows out but keeps a reference-only day', async () => {
  const result = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      const written = yield* entries.save(
        draft('2026-03-01', 'Written, then cleared.'),
      );
      yield* entries.save(draft('2026-03-01', '', '', written.revision));
      yield* entries.save(draft('2026-03-02', ''));
      yield* entries.save(draft('2026-03-03', '', 'Psalms 23'));
      return yield* collect(exports);
    }),
  );

  expect(result.count).toBe(1);
  expect(result.first.map(({ date }) => date)).toEqual(['2026-03-03']);
  expect(result.first[0]?.scriptureReference).toEqual({
    book: 'Psalms',
    chapter: 23,
    verseStart: null,
    verseEnd: null,
  });
});

it('projects stored timestamp provenance as exact UTC microsecond text', async () => {
  const exported = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* entries.save(draft('2026-03-01', 'Exact.'));
      yield* sql`
        update entry
        set
          journal_first_used_at = '2026-03-01T01:02:03.123456+01:00',
          scripture_first_used_at = null,
          created_at = '2026-02-28T23:59:59.000001Z',
          updated_at = '2026-03-01T00:02:03.654321Z'
        where entry_date = '2026-03-01'
      `;
      return (yield* collect(exports)).first[0];
    }),
  );

  expect(exported).toMatchObject({
    journalFirstUsedAt: '2026-03-01T00:02:03.123456Z',
    scriptureFirstUsedAt: null,
    createdAt: '2026-02-28T23:59:59.000001Z',
    updatedAt: '2026-03-01T00:02:03.654321Z',
  });
});

it('streams one exact snapshot instant into every ZIP document', async () => {
  const result = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-02', 'Second day.'));
      yield* entries.save(draft('2026-03-01', 'First day.'));
      let context:
        | {
            readonly exportedAt: string;
            readonly journalDate: string;
            readonly timeZone: string;
          }
        | undefined;
      const chunks = yield* exportArchiveStream(
        exports,
        'Europe/Berlin',
        (observed) => {
          context = observed;
        },
      ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
      return { chunks, context };
    }),
  );
  const files = unzipSync(bytesOf(result.chunks));
  const decoder = new TextDecoder();
  const manifest = parseManifestDocument(
    decoder.decode(files['manifest.json']),
  );
  const exportedEntries = parseEntriesDocument(
    decoder.decode(files['entries.ndjson']),
  );
  const readme = decoder.decode(files['README.md']);

  const { context } = result;
  if (context === undefined) {
    throw new TypeError('The export did not publish its snapshot context.');
  }
  expect(manifest.exportedAt).toMatch(microsecondTimestampEnd);
  expect(manifest.exportedAt).toBe(context.exportedAt);
  expect(manifest.journalDate).toBe(context.journalDate);
  expect(readme).toContain(manifest.exportedAt);
  expect(manifest.entries.count).toBe(2);
  expect(exportedEntries.map(({ date }) => date)).toEqual([
    '2026-03-01',
    '2026-03-02',
  ]);
  expect(decoder.decode(files['days/2026/2026-03-01.md'])).toContain(
    'First day.',
  );
});
