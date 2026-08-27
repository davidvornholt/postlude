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

const { withJournal } = journalDatabase();

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

it('leaves cleared and never-written rows out but keeps a reference-only day', async () => {
  const result = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'Written, then cleared.'));
      yield* entries.save(draft('2026-03-01', ''));
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

it('streams a database snapshot into authoritative and readable ZIP members', async () => {
  const chunks = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-02', 'Second day.'));
      yield* entries.save(draft('2026-03-01', 'First day.'));
      return yield* exportArchiveStream(exports, {
        exportedAt: new Date('2026-08-26T20:00:00.000Z'),
        journalDate: '2026-08-26',
        timeZone: 'Europe/Berlin',
      }).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
    }),
  );
  const files = unzipSync(bytesOf(chunks));
  const decoder = new TextDecoder();
  const manifest = parseManifestDocument(
    decoder.decode(files['manifest.json']),
  );
  const exportedEntries = parseEntriesDocument(
    decoder.decode(files['entries.ndjson']),
  );

  expect(manifest.entries.count).toBe(2);
  expect(exportedEntries.map(({ date }) => date)).toEqual([
    '2026-03-01',
    '2026-03-02',
  ]);
  expect(decoder.decode(files['days/2026/2026-03-01.md'])).toContain(
    'First day.',
  );
});
