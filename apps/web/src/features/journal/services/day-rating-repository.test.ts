import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import { dayClosedMessage, ratingsNeededMessage } from '../evening-messages.ts';
import { journalDatabase } from '../testing/database-harness.ts';
import { refusalOf } from '../testing/sql-refusal.ts';

const { withEvening } = journalDatabase();

const day = '2026-10-09';

it('reads an unrated day as empty and open', async () => {
  const rating = await withEvening(({ ratings }) => ratings.read(day));
  expect(rating).toEqual({
    energy: null,
    progress: null,
    repeatDay: null,
    ratingVersion: null,
    closedAt: null,
  });
});

it('saves each rating on its own and keeps the others', async () => {
  const rating = await withEvening(({ ratings }) =>
    Effect.gen(function* () {
      yield* ratings.save({ date: day, energy: 'okay' });
      yield* ratings.save({ date: day, progress: 'solid' });
      return yield* ratings.save({ date: day, repeatDay: 'partly' });
    }),
  );
  expect(rating).toEqual({
    energy: 'okay',
    progress: 'solid',
    repeatDay: 'partly',
    ratingVersion: 1,
    closedAt: null,
  });
});

it('clears a rating given as null', async () => {
  const rating = await withEvening(({ ratings }) =>
    Effect.gen(function* () {
      yield* ratings.save({ date: day, energy: 'fresh', progress: 'a_lot' });
      return yield* ratings.save({ date: day, energy: null });
    }),
  );
  expect(rating.energy).toBeNull();
  expect(rating.progress).toBe('a_lot');
});

it('refuses to close a day without energy and progress', async () => {
  const error = await withEvening(({ ratings }) =>
    Effect.gen(function* () {
      yield* ratings.save({ date: day, energy: 'okay', repeatDay: 'yes' });
      return yield* Effect.flip(ratings.close(day));
    }),
  );
  expect(error.message).toBe(ratingsNeededMessage);
});

it('refuses to close a day never rated', async () => {
  const error = await withEvening(({ ratings }) =>
    Effect.flip(ratings.close(day)),
  );
  expect(error.message).toBe(ratingsNeededMessage);
});

it('closes a rated day once, and keeps its ratings from changing', async () => {
  const outcome = await withEvening(({ ratings }) =>
    Effect.gen(function* () {
      yield* ratings.save({ date: day, energy: 'drained', progress: 'little' });
      const first = yield* ratings.close(day);
      const second = yield* ratings.close(day);
      const refused = yield* Effect.flip(
        ratings.save({ date: day, energy: 'fresh' }),
      );
      return { first, second, refused, after: yield* ratings.read(day) };
    }),
  );
  expect(outcome.first.closedNow).toBe(true);
  expect(outcome.first.rating.closedAt).toBeInstanceOf(Date);
  expect(outcome.second.closedNow).toBe(false);
  expect(outcome.second.rating.closedAt).toEqual(outcome.first.rating.closedAt);
  expect(outcome.refused.message).toBe(dayClosedMessage);
  expect(outcome.after.energy).toBe('drained');
});

it('reopens a closed day for changes', async () => {
  const rating = await withEvening(({ ratings }) =>
    Effect.gen(function* () {
      yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
      yield* ratings.close(day);
      const reopened = yield* ratings.reopen(day);
      expect(reopened.closedAt).toBeNull();
      return yield* ratings.save({ date: day, energy: 'fresh' });
    }),
  );
  expect(rating.energy).toBe('fresh');
  expect(rating.closedAt).toBeNull();
});

it('leaves a day it cannot reopen as it was', async () => {
  const rating = await withEvening(({ ratings }) => ratings.reopen(day));
  expect(rating.closedAt).toBeNull();
  expect(rating.ratingVersion).toBeNull();
});

it('lets the database refuse values outside the scales', async () => {
  const refusals = await withEvening(({ sql }) =>
    Effect.all([
      refusalOf(
        sql,
        sql`insert into day_rating (entry_date, energy, rating_version) values (${day}, 'great', 1)`,
      ),
      refusalOf(
        sql,
        sql`insert into day_rating (entry_date, progress, rating_version) values (${day}, 'some', 1)`,
      ),
      refusalOf(
        sql,
        sql`insert into day_rating (entry_date, repeat_day, rating_version) values (${day}, 'maybe', 1)`,
      ),
      refusalOf(
        sql,
        sql`insert into day_rating (entry_date, energy, rating_version, closed_at) values (${day}, 'okay', 1, now())`,
      ),
      refusalOf(
        sql,
        sql`insert into day_rating (entry_date, rating_version) values (${day}, 0)`,
      ),
    ]),
  );
  expect(refusals.map(({ constraint }) => constraint)).toEqual([
    'day_rating_energy_scale',
    'day_rating_progress_scale',
    'day_rating_repeat_day_scale',
    'day_rating_closed_when_rated',
    'day_rating_version_positive',
  ]);
});
