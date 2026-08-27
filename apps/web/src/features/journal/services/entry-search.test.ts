/**
 * Search against a real Postgres, because everything it claims belongs to the
 * database: whether the stored index really covers the evening, the morning and
 * the book name, whether a term written as a prefix reaches the longer word,
 * and whether a day holding only some of the typed words is left out.
 *
 * `testing/database-harness.ts` owns the pool, the runtime and the rollback;
 * `shared/testing/test-database.ts` owns the database itself and says what
 * these tests do and do not touch.
 */

import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import { searchTerms, searchTsQuery } from '../search-query.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';

const { withJournal } = journalDatabase();

/** More than any of these tests writes, so nothing is cut off by accident. */
const plenty = 20;

const asked = (query: string) => searchTsQuery(searchTerms(query));

const datesFor = (query: string, limit = plenty) =>
  withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(
        draft('2026-03-01', 'Evening. The rain fell all night.'),
      );
      yield* entries.save(
        draft('2026-03-02', 'Evening. A long walk, and then more rain.'),
      );
      yield* entries.save(draft('2026-03-03', 'Evening. Sun, nothing else.'));
      const matches = yield* search.search(asked(query), limit);
      return matches.map((match) => match.date);
    }),
  );

it('finds the days that hold the word', async () => {
  expect(await datesFor('rain')).toEqual(['2026-03-02', '2026-03-01']);
});

it('finds nothing for a word nobody wrote', async () => {
  expect(await datesFor('snow')).toEqual([]);
});

/*
 * Every term has to appear. A day holding only one of two typed words answers a
 * different question than the one that was asked.
 */
it('leaves out a day that holds only some of the words', async () => {
  expect(await datesFor('rain walk')).toEqual(['2026-03-02']);
});

it('reads the newest day first', async () => {
  expect(await datesFor('evening')).toEqual([
    '2026-03-03',
    '2026-03-02',
    '2026-03-01',
  ]);
});

it('stops at the number of days it was asked for', async () => {
  const one = 1;
  expect(await datesFor('rain', one)).toEqual(['2026-03-02']);
});

/*
 * The index is built with Postgres's `simple` configuration and every term is
 * matched as a prefix, so a search finds the longer word without the database
 * having to know which language the day was written in.
 */
it('reaches a longer word from the start of it', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'Gebete am Morgen.'));
      const matches = yield* search.search(asked('gebet'), plenty);
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual(['2026-03-01']);
});

it('does not reach a word from the middle of it', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'Ein Vorgebet.'));
      const matches = yield* search.search(asked('gebet'), plenty);
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual([]);
});

it('searches the morning passage as well as the evening', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save({
        date: '2026-03-01',
        journalMarkdown: 'A quiet evening.',
        scriptureMarkdown: 'Der Herr ist mein Hirte.',
        scriptureReference: 'Psalms 23',
      });
      const matches = yield* search.search(asked('hirte'), plenty);
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual(['2026-03-01']);
});

it('finds a day by the book its morning came from', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(
        draft('2026-03-01', 'A quiet evening.', 'Sprüche 12,5-13'),
      );
      const matches = yield* search.search(asked('proverbs'), plenty);
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual(['2026-03-01']);
});

/*
 * The index is a stored column the database keeps for the row, so a rewritten
 * day is searchable as what it now says and not as what it used to.
 */
it('forgets a word the writer took back out', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'The rain fell all night.'));
      yield* entries.save(draft('2026-03-01', 'Clear, in the end.'));
      const matches = yield* search.search(asked('rain'), plenty);
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual([]);
});

it('hands back the indexed visible sources and the day, counted', async () => {
  const words = 5;
  const match = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save({
        date: '2026-03-01',
        journalMarkdown: 'The rain fell all night.',
        scriptureMarkdown: '',
        scriptureReference: 'Psalms 23',
      });
      const matches = yield* search.search(asked('rain'), plenty);
      return matches.at(0);
    }),
  );
  expect(match?.journalText).toBe('The rain fell all night.');
  expect(match?.scriptureText).toBe('');
  expect(match?.scriptureReferenceText).toContain('Psalms 23');
  expect(match?.scriptureReferenceText).toContain('Psalm 23');
  expect(match?.words).toBe(words);
});

it('does not match hidden markdown syntax or fenced code', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(
        draft(
          '2026-03-01',
          '[visible](secret-target)\n```\nsecret-code\n```\n![alt](secret-file)',
        ),
      );
      const matches = yield* search.search(asked('secret'), plenty);
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual([]);
});

it('matches punctuation-delimited words and canonically normalized text', async () => {
  const dates = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'Rain,fell by Sprüche.'));
      const matches = yield* search.search(
        asked('rain fell Spru\u0308che'),
        plenty,
      );
      return matches.map((match) => match.date);
    }),
  );
  expect(dates).toEqual(['2026-03-01']);
});

it('finds a reference by German names and keyboard aliases', async () => {
  const labels = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(
        draft('2026-03-01', 'A quiet evening.', 'Sprüche 12,5-13'),
      );
      const german = yield* search.search(asked('sprüche'), plenty);
      const keyboard = yield* search.search(asked('sprueche'), plenty);
      const alias = yield* search.search(asked('spr'), plenty);
      return [german, keyboard, alias].map(
        (matches) => matches[0]?.scriptureReferenceText,
      );
    }),
  );
  for (const label of labels) {
    expect(label).toContain('Sprüche 12:5-13');
  }
});
