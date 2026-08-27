import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import { searchTerms, searchTsQuery } from '../search-query.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';

const { withJournal } = journalDatabase();

const plenty = 20;

const asked = (query: string) => searchTsQuery(searchTerms(query));

it('uses the same canonical tokens for punctuation and difficult case folds', async () => {
  const prose =
    'Mail.Name@example.com https://Example.com/A.B/path Version 1.2 İSTANBUL ΟΣ.';
  const observed = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', prose, '1 John 3:16'));
      const queries = [
        'mail/name',
        'example.com/a.b/path',
        'version/1.2',
        'istanbul',
        'οσ',
        '1.john',
      ];
      const answers = yield* Effect.all(
        queries.map((query) => search.search(asked(query), plenty)),
        { concurrency: 1 },
      );
      return { answers, raw: answers[0]?.[0]?.journalText };
    }),
  );
  expect(observed.answers.map((answers) => answers[0]?.date)).toEqual([
    '2026-03-01',
    '2026-03-01',
    '2026-03-01',
    '2026-03-01',
    '2026-03-01',
    '2026-03-01',
  ]);
  expect(observed.raw).toBe(prose);
});

it('finds Song of Songs through every accepted joined and natural German spelling', async () => {
  const observed = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(
        draft('2026-03-01', 'A quiet evening.', 'Hohes Lied 2:10'),
      );
      const queries = ['Hohes Lied', 'Hoheslied', 'Hohe Lied', 'Hohelied'];
      const answers = yield* Effect.all(
        queries.map((query) => search.search(asked(query), plenty)),
        { concurrency: 1 },
      );
      return answers;
    }),
  );
  expect(observed.map((answers) => answers[0]?.date)).toEqual([
    '2026-03-01',
    '2026-03-01',
    '2026-03-01',
    '2026-03-01',
  ]);
  for (const answers of observed) {
    expect(answers).toHaveLength(1);
    expect(answers[0]?.scriptureReferenceText).toContain('Hohes Lied 2:10');
  }
});
