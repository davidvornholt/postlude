/**
 * The repository against a real Postgres, because that is the only place its
 * claims are actually settled. Whether the upsert really replaces a day,
 * whether a DATE column comes back as the calendar date it was written as
 * rather than an instant shifted by a timezone, and whether the check
 * constraints accept a whole-chapter reference are all properties of the
 * database, not of the code that talks to it.
 *
 * `shared/testing/test-database.ts` owns the database and the rollback; see it
 * for what these tests do and do not touch.
 */

import { afterAll, beforeAll, expect, it } from 'bun:test';
import type { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Layer, ManagedRuntime } from 'effect';

import {
  openTestDatabase,
  rolledBack,
  type TestPool,
} from '#/shared/testing/test-database.ts';
import type { EntryDraft } from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';

let pool: TestPool;
let runtime: ManagedRuntime.ManagedRuntime<
  EntryRepository | SqlClient.SqlClient,
  never
>;

beforeAll(async () => {
  pool = await openTestDatabase();
  const clientLayer = pgClientLayer(pool);
  runtime = ManagedRuntime.make(
    Layer.provideMerge(
      Layer.provide(EntryRepository.Default, clientLayer),
      clientLayer,
    ).pipe(Layer.orDie),
  );
});

afterAll(async () => {
  await runtime.dispose();
  await pool.end();
});

/** Runs the body against the repository and leaves the table as it was. */
const withRepository = <A, E>(
  body: (entries: EntryRepository) => Effect.Effect<A, E>,
): Promise<A> =>
  runtime.runPromise(rolledBack(Effect.flatMap(EntryRepository, body)));

/** As many earlier years as the archive asks for; the page shows four. */
const anniversaryLimit = 4;

const draft = (
  date: string,
  journalMarkdown: string,
  scriptureReference = '',
): EntryDraft => ({
  date,
  journalMarkdown,
  scriptureMarkdown: '',
  scriptureReference,
});

it('reads nothing for a day that was never written', async () => {
  const entry = await withRepository((entries) => entries.read('2019-04-02'));
  expect(entry).toBeUndefined();
});

it('gives back the day it stored, counted by the server', async () => {
  const prose = 'A quiet evening, and the rain finally stopped.';
  const words = 8;
  const entry = await withRepository((entries) =>
    entries.save(draft('2026-08-25', prose)),
  );
  expect(entry.date).toBe('2026-08-25');
  expect(entry.journalMarkdown).toBe(prose);
  expect(entry.journalWordCount).toBe(words);
  expect(entry.scriptureWordCount).toBe(0);
  expect(entry.scriptureReference).toBeUndefined();
});

it('keeps the date a calendar date rather than an instant', async () => {
  const entry = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-01-01', 'The first day.'));
      return yield* entries.read('2026-01-01');
    }),
  );
  expect(entry?.date).toBe('2026-01-01');
});

it('replaces a day rather than failing on the second save', async () => {
  const words = 3;
  const entry = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-08-25', 'A first pass at the evening.'));
      return yield* entries.save(
        draft('2026-08-25', 'Rewritten, and shorter.'),
      );
    }),
  );
  expect(entry.journalMarkdown).toBe('Rewritten, and shorter.');
  expect(entry.journalWordCount).toBe(words);
});

it('keeps the creation stamp of the day it is rewriting', async () => {
  const [first, second] = await withRepository((entries) =>
    Effect.gen(function* () {
      const created = yield* entries.save(draft('2026-08-25', 'First.'));
      const rewritten = yield* entries.save(draft('2026-08-25', 'Second.'));
      return [created, rewritten] as const;
    }),
  );
  expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
});

it('stores a verse range as the four columns the archive reads', async () => {
  const entry = await withRepository((entries) =>
    entries.save(draft('2026-08-25', 'Read it slowly.', 'Sprüche 12,5-13')),
  );
  expect(entry.scriptureReference).toEqual({
    book: 'Proverbs',
    chapter: 12,
    verseStart: 5,
    verseEnd: 13,
  });
});

it('accepts a whole chapter, which has no verse at all', async () => {
  const entry = await withRepository((entries) =>
    entries.save(draft('2026-08-25', 'The whole psalm.', 'Psalms 23')),
  );
  expect(entry.scriptureReference).toEqual({ book: 'Psalms', chapter: 23 });
});

it('drops a reference the writer removed', async () => {
  const entry = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-08-25', 'With one.', 'Psalms 23'));
      return yield* entries.save(draft('2026-08-25', 'Without one.'));
    }),
  );
  expect(entry.scriptureReference).toBeUndefined();
});

it('lists a range inclusively and in calendar order', async () => {
  const summaries = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'One.'));
      yield* entries.save(draft('2026-03-15', 'Two words here.', 'Psalms 23'));
      yield* entries.save(draft('2026-03-31', 'Three.'));
      yield* entries.save(draft('2026-04-01', 'Outside the range.'));
      return yield* entries.listBetween('2026-03-01', '2026-03-31');
    }),
  );
  expect(summaries.map((summary) => summary.date)).toEqual([
    '2026-03-01',
    '2026-03-15',
    '2026-03-31',
  ]);
  expect(summaries.map((summary) => summary.hasScriptureReference)).toEqual([
    false,
    true,
    false,
  ]);
});

it('finds the same day of the month in earlier years, newest first', async () => {
  const anniversaries = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2024-08-26', 'Two years back.'));
      yield* entries.save(draft('2025-08-26', 'One year back.'));
      yield* entries.save(draft('2025-08-25', 'The day before, once.'));
      yield* entries.save(draft('2026-08-26', 'Today itself.'));
      return yield* entries.readAnniversaries(
        '08-26',
        '2026-08-26',
        anniversaryLimit,
      );
    }),
  );
  expect(anniversaries.map((entry) => entry.date)).toEqual([
    '2025-08-26',
    '2024-08-26',
  ]);
});

/*
 * A day whose morning holds a passage and whose evening holds nothing has
 * nothing to show in a list of openings, so it is left out rather than listed
 * as a blank line.
 */
it('leaves out an anniversary with no evening prose', async () => {
  const anniversaries = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save({
        date: '2025-08-26',
        journalMarkdown: '',
        scriptureMarkdown: '',
        scriptureReference: 'Psalms 23',
      });
      return yield* entries.readAnniversaries(
        '08-26',
        '2026-08-26',
        anniversaryLimit,
      );
    }),
  );
  expect(anniversaries).toEqual([]);
});

it('reports no earliest day while the journal is empty', async () => {
  const earliest = await withRepository((entries) => entries.earliestDate());
  expect(earliest).toBeUndefined();
});

it('reports the oldest written day as where the archive starts', async () => {
  const earliest = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-15', 'Later.'));
      yield* entries.save(draft('2025-11-02', 'Earlier.'));
      return yield* entries.earliestDate();
    }),
  );
  expect(earliest).toBe('2025-11-02');
});
