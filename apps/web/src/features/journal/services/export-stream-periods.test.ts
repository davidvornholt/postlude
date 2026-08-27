import { describe, expect, it } from 'bun:test';
import { Chunk, Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import { parseEntriesDocument } from '../export-format.ts';
import type { ExportGrouping } from '../export-period.ts';
import { shiftJournalDate } from '../journal-day.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import { exportPageSize } from './entry-export.ts';
import { exportArchiveStream } from './export-stream.ts';

const { withJournal } = journalDatabase();
const decoder = new TextDecoder();
const authoritativePaths = ['manifest.json', 'entries.ndjson', 'README.md'];
const pageBoundaryOverflow = 2;
const dates = [
  '0001-01-01',
  '2025-12-28',
  '2025-12-31',
  '2026-01-01',
  '2026-02-03',
  '9999-12-31',
] as const;

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

const exportFiles = (grouping: ExportGrouping) =>
  withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      for (const date of dates) {
        yield* entries.save(
          draft(
            date,
            `Evening ${date}.`,
            date === '2025-12-31' ? 'Psalms 23' : '',
          ),
        );
      }
      const chunks = yield* exportArchiveStream(
        exports,
        'Europe/Berlin',
        () => undefined,
        grouping,
      ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
      return unzipSync(bytesOf(chunks));
    }),
  );

const expectedProjectionPaths: Record<ExportGrouping, ReadonlyArray<string>> = {
  day: [
    'days/0001/0001-01-01.md',
    'days/2025/2025-12-28.md',
    'days/2025/2025-12-31.md',
    'days/2026/2026-01-01.md',
    'days/2026/2026-02-03.md',
    'days/9999/9999-12-31.md',
  ],
  week: [
    'weeks/0001/0001-W01.md',
    'weeks/2025/2025-W52.md',
    'weeks/2026/2026-W01.md',
    'weeks/2026/2026-W06.md',
    'weeks/9999/9999-W52.md',
  ],
  month: [
    'months/0001/0001-01.md',
    'months/2025/2025-12.md',
    'months/2026/2026-01.md',
    'months/2026/2026-02.md',
    'months/9999/9999-12.md',
  ],
  year: ['0001.md', '2025.md', '2026.md', '9999.md'],
};

describe('production projection streams', () => {
  it.each(['day', 'week', 'month', 'year'] as const)(
    'writes exact records and ordered %s members from sparse dates',
    async (grouping) => {
      const files = await exportFiles(grouping);
      expect(Object.keys(files)).toEqual([
        ...authoritativePaths,
        ...expectedProjectionPaths[grouping],
      ]);
      expect(
        parseEntriesDocument(decoder.decode(files['entries.ndjson'])).map(
          ({ date }) => date,
        ),
      ).toEqual([...dates]);
    },
  );

  it('keeps a New Year ISO week together with its reference and day order', async () => {
    const files = await exportFiles('week');
    const document = decoder.decode(files['weeks/2026/2026-W01.md']);

    expect(document).toContain('period: "2026-W01"');
    expect(document).toContain('from: "2025-12-31"');
    expect(document).toContain('to: "2026-01-01"');
    expect(document).toContain('days: 2');
    expect(document).toContain('Passage: Psalms 23');
    expect(document.indexOf('## 2025-12-31')).toBeLessThan(
      document.indexOf('## 2026-01-01'),
    );
  });

  it('counts sparse written days rather than calendar days', async () => {
    const files = await exportFiles('month');
    const december = decoder.decode(files['months/2025/2025-12.md']);

    expect(december).toContain('from: "2025-12-28"');
    expect(december).toContain('to: "2025-12-31"');
    expect(december).toContain('days: 2');
  });

  it('crosses metadata and entry page boundaries without losing order', async () => {
    const pagedDates = Array.from(
      { length: exportPageSize + pageBoundaryOverflow },
      (_, index) => shiftJournalDate('2024-01-01', index),
    );
    const files = await withJournal(({ entries, exports }) =>
      Effect.gen(function* () {
        for (const date of pagedDates) {
          yield* entries.save(draft(date, `Evening ${date}.`, ''));
        }
        const chunks = yield* exportArchiveStream(
          exports,
          'Europe/Berlin',
          () => undefined,
          'year',
        ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
        return unzipSync(bytesOf(chunks));
      }),
    );
    const document = decoder.decode(files['2024.md']);

    expect(document).toContain(`days: ${pagedDates.length}`);
    expect(
      parseEntriesDocument(decoder.decode(files['entries.ndjson'])),
    ).toHaveLength(pagedDates.length);
    expect(document.indexOf('## 2024-01-01')).toBeLessThan(
      document.indexOf(`## ${pagedDates.at(-1)}`),
    );
  });
});
