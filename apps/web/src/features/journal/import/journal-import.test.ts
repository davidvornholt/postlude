import { expect, it } from 'bun:test';

import { validateImportRecords } from './journal-import.ts';

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
