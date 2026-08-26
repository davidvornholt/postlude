/**
 * The export's read against a real Postgres, because what it claims is about
 * the table: that every written day comes back, in the order the journal was
 * written, with the parts an exported file is made of intact.
 *
 * `testing/database-harness.ts` owns the pool, the runtime and the rollback;
 * `shared/testing/test-database.ts` owns the database itself and says what
 * these tests do and do not touch.
 */

import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import { draft, journalDatabase } from '../testing/database-harness.ts';

const { withJournal } = journalDatabase();

const chapter = 12;
const verseStart = 5;
const verseEnd = 13;

it('reads every written day, oldest first', async () => {
  const dates = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      // Written out of order on purpose: the read is what puts them back in it.
      yield* entries.save(draft('2026-03-02', 'A long walk.'));
      yield* entries.save(draft('2025-12-31', 'The last of it.'));
      yield* entries.save(draft('2026-03-01', 'The rain fell all night.'));
      const all = yield* exports.readAll();
      return all.map((entry) => entry.date);
    }),
  );

  expect(dates).toEqual(['2025-12-31', '2026-03-01', '2026-03-02']);
});

it('reads nothing from an empty journal', async () => {
  const all = await withJournal(({ exports }) => exports.readAll());

  expect(all).toEqual([]);
});

it('carries the prose a file is written from', async () => {
  const entry = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'The rain fell all night.'));
      const all = yield* exports.readAll();
      return all[0];
    }),
  );

  expect(entry?.journalMarkdown).toBe('The rain fell all night.');
});

/*
 * The reference is stored as four columns and read back as one value. An export
 * writes that value into the file, so a read that lost it would put out files
 * with no passage on days that had one.
 */
it('carries the passage back as the reference it was', async () => {
  const entry = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'Evening.', 'Proverbs 12:5-13'));
      const all = yield* exports.readAll();
      return all[0];
    }),
  );

  expect(entry?.scriptureReference).toEqual({
    book: 'Proverbs',
    chapter,
    verseStart,
    verseEnd,
  });
});
