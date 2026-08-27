import { describe, expect, it } from 'bun:test';
import { Chunk, Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import { parseEntriesDocument } from '../export-format.ts';
import { shiftJournalDate } from '../journal-day.ts';
import { EntryExport, type ExportEntry } from './entry-export.ts';
import { exportArchiveStream, exportContextAt } from './export-stream.ts';

const separatedBacktickRunCount = 1_000_000;
const leapYearDayCount = 366;
const largeDayTextRepetitions = 8192;
const largeDayText = 'journal '.repeat(largeDayTextRepetitions);
const leapYearIndexes = Array.from(
  { length: leapYearDayCount },
  (_, index) => index,
);
const timestamp = '2026-03-01T20:00:00.000000Z';

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

const exportsOf = (entries: ReadonlyArray<ExportEntry>): EntryExport =>
  EntryExport.make({
    visit: (visitor) =>
      Effect.gen(function* () {
        yield* visitor.onSnapshot({
          exportedAt: '2026-08-26T20:00:00.123456Z',
        });
        yield* visitor.onCount(entries.length);
        for (const pass of visitor.passes) {
          yield* pass.before;
          yield* Effect.forEach(entries, pass.onEntry, { discard: true });
          yield* pass.after;
        }
      }),
  });

const visitLeapYearEntries = <E, R>(
  onEntry: (entry: ExportEntry) => Effect.Effect<void, E, R>,
  entryAt: (index: number) => ExportEntry,
  onVisit: () => void = () => undefined,
) =>
  Effect.forEach(
    leapYearIndexes,
    (index) =>
      Effect.sync(onVisit).pipe(Effect.zipRight(onEntry(entryAt(index)))),
    { discard: true },
  );

const readUntil = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: () => boolean,
): Promise<boolean> => {
  const result = await reader.read();
  if (result.done || predicate()) {
    return result.done;
  }
  return readUntil(reader, predicate);
};

it('streams a million separated backtick runs without losing source or joining sections', async () => {
  const morning = '`x'.repeat(separatedBacktickRunCount);
  const evening = 'Evening exact.\n```still source';
  const entry: ExportEntry = {
    date: '2026-03-01',
    journalMarkdown: evening,
    scriptureMarkdown: morning,
    scriptureReference: null,
    journalFirstUsedAt: timestamp,
    scriptureFirstUsedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const chunks = await Effect.runPromise(
    exportArchiveStream(
      exportsOf([entry]),
      'Europe/Berlin',
      () => undefined,
    ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray)),
  );
  const files = unzipSync(bytesOf(chunks));
  const decoder = new TextDecoder();

  expect(parseEntriesDocument(decoder.decode(files['entries.ndjson']))).toEqual(
    [entry],
  );
  expect(decoder.decode(files['days/2026/2026-03-01.md'])).toBe(
    `---\ndate: "2026-03-01"\n---\n\n## Morning\n\n\`\`\`markdown\n${morning}\n\`\`\`\n\n## Evening\n\n\`\`\`\`markdown\n${evening}\n\`\`\`\`\n`,
  );
});

it('backpressures a large leap-year period and releases its snapshot on cancellation', async () => {
  let projectedDays = 0;
  let snapshotReleased = false;
  const entryAt = (index: number): ExportEntry => ({
    date: shiftJournalDate('2024-01-01', index),
    journalMarkdown: largeDayText,
    scriptureMarkdown: '',
    scriptureReference: null,
    journalFirstUsedAt: timestamp,
    scriptureFirstUsedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const exports = EntryExport.make({
    visit: (visitor) =>
      Effect.acquireUseRelease(
        Effect.void,
        () =>
          Effect.gen(function* () {
            yield* visitor.onSnapshot({
              exportedAt: '2026-08-26T20:00:00.123456Z',
            });
            yield* visitor.onCount(leapYearDayCount);
            for (const pass of visitor.passes) {
              yield* pass.before;
              yield* visitLeapYearEntries(pass.onEntry, entryAt);
              yield* pass.after;
            }
            const { periodPass } = visitor;
            if (periodPass !== undefined) {
              yield* periodPass.before;
              yield* periodPass.onPeriodStart({
                key: '2024',
                from: '2024-01-01',
                to: '2024-12-31',
                days: leapYearDayCount,
              });
              yield* visitLeapYearEntries(periodPass.onEntry, entryAt, () => {
                projectedDays += 1;
              });
              yield* periodPass.onPeriodEnd;
              yield* periodPass.after;
            }
          }),
        () =>
          Effect.sync(() => {
            snapshotReleased = true;
          }),
      ),
  });
  const body = Stream.toReadableStream(
    exportArchiveStream(exports, 'Europe/Berlin', () => undefined, 'year'),
  );
  const reader = body.getReader();

  expect(await readUntil(reader, () => projectedDays > 0)).toBeFalse();
  expect(projectedDays).toBeLessThan(leapYearDayCount);
  expect(snapshotReleased).toBeFalse();

  await reader.cancel();
  expect(snapshotReleased).toBeTrue();
});

const contextAt = (exportedAt: string) =>
  exportContextAt({ exportedAt }, 'Europe/Berlin');

describe('export snapshot journal day', () => {
  it('uses the same microsecond instant on both sides of the 04:00 boundary', () => {
    expect(contextAt('2026-08-27T01:59:59.999999Z')).toMatchObject({
      exportedAt: '2026-08-27T01:59:59.999999Z',
      journalDate: '2026-08-26',
    });
    expect(contextAt('2026-08-27T02:00:00.000000Z').journalDate).toBe(
      '2026-08-27',
    );
  });

  it('keeps 04:00 local across both daylight-saving transitions', () => {
    expect(contextAt('2026-03-29T01:59:59.999999Z').journalDate).toBe(
      '2026-03-28',
    );
    expect(contextAt('2026-03-29T02:00:00.000000Z').journalDate).toBe(
      '2026-03-29',
    );
    expect(contextAt('2026-10-25T02:59:59.999999Z').journalDate).toBe(
      '2026-10-24',
    );
    expect(contextAt('2026-10-25T03:00:00.000000Z').journalDate).toBe(
      '2026-10-25',
    );
  });
});
