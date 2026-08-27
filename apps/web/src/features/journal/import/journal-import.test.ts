import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import {
  importJournalRecords,
  validateImportRecords,
} from './journal-import.ts';

const record = (date: string, source: string) => ({
  date,
  source,
  journalMarkdown: 'Journal',
  scriptureMarkdown: '',
});

it('gathers duplicate and future-date validation failures', () => {
  expect(
    validateImportRecords(
      [record('2026-08-28', 'future.md'), record('2026-08-28', 'same.md')],
      '2026-08-27',
    ),
  ).toEqual([
    {
      source: 'future.md',
      message: 'Entry date 2026-08-28 is in the future.',
    },
    {
      source: 'same.md',
      message: 'Entry date 2026-08-28 is in the future.',
    },
    {
      source: 'future.md, same.md',
      message: 'Several source files claim 2026-08-28.',
    },
  ]);
});

it('waits for each insert before using the transaction client again', async () => {
  let activeInserts = 0;
  let maximumActiveInserts = 0;
  const client = {
    query: async (query: string) => {
      if (query.includes('from entry')) {
        return { rows: [] };
      }
      if (query.includes('insert into entry')) {
        activeInserts += 1;
        maximumActiveInserts = Math.max(maximumActiveInserts, activeInserts);
        await Promise.resolve();
        activeInserts -= 1;
      }
      return { rows: [] };
    },
    release: () => undefined,
  };
  const pool = {
    connect: async () => client,
  } as unknown as Parameters<typeof importJournalRecords>[0];

  const summary = await Effect.runPromise(
    importJournalRecords(pool, [
      record('2026-08-24', 'one.md'),
      record('2026-08-25', 'two.md'),
      record('2026-08-26', 'three.md'),
    ]),
  );

  expect(summary).toEqual({ inserted: 3, unchanged: 0 });
  expect(maximumActiveInserts).toBe(1);
});
