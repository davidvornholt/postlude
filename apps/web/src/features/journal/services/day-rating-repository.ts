/**
 * David's ratings of a day, and closing and reopening it.
 *
 * A closed day keeps its ratings: the agent note was written from them, so a
 * rating changes only after the day is reopened, and closing it again asks for
 * a new note. Closing needs energy and progress; the database refuses a closed
 * day without them too, so this is checked twice rather than trusted once.
 */

import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import {
  JournalValidationError,
  journalReadError,
  journalWriteError,
} from '../errors/journal-errors.ts';
import { dayClosedMessage, ratingsNeededMessage } from '../evening-messages.ts';
import {
  currentRatingVersion,
  type DayRating,
  type DayRatingChange,
  DayRatingFromRow,
  emptyDayRating,
} from '../schemas/day-rating.ts';

const decodeRatings = Schema.decodeUnknownEffect(
  Schema.Array(DayRatingFromRow),
);

/** What `close` did: closed the day now, or found it closed already. */
export type DayClosing = {
  readonly rating: DayRating;
  readonly closedNow: boolean;
};

export class DayRatingRepository extends Context.Service<DayRatingRepository>()(
  'journal/DayRatingRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const read = (date: string) =>
        sql`
          select energy, progress, repeat_day, rating_version, closed_at
          from day_rating
          where entry_date = ${date}
        `.pipe(
          Effect.flatMap(decodeRatings),
          Effect.map((rows) => rows[0] ?? emptyDayRating),
          Effect.mapError(journalReadError),
        );

      /**
       * Each key the change names is written, and the rest keep their value.
       * The update applies only while the day is open, so a closed day comes
       * back without a row and is refused.
       */
      const save = (change: DayRatingChange) => {
        const names = (key: keyof DayRatingChange) => change[key] !== undefined;
        return sql`
          insert into day_rating (entry_date, energy, progress, repeat_day, rating_version)
          values (
            ${change.date},
            ${change.energy ?? null},
            ${change.progress ?? null},
            ${change.repeatDay ?? null},
            ${currentRatingVersion}
          )
          on conflict (entry_date) do update set
            energy = case when ${names('energy')}::boolean then excluded.energy else day_rating.energy end,
            progress = case when ${names('progress')}::boolean then excluded.progress else day_rating.progress end,
            repeat_day = case when ${names('repeatDay')}::boolean then excluded.repeat_day else day_rating.repeat_day end,
            rating_version = excluded.rating_version,
            updated_at = now()
          where day_rating.closed_at is null
          returning energy, progress, repeat_day, rating_version, closed_at
        `.pipe(
          Effect.flatMap(decodeRatings),
          Effect.mapError(journalWriteError),
          Effect.flatMap(([saved]) =>
            saved === undefined
              ? Effect.fail(
                  new JournalValidationError({ message: dayClosedMessage }),
                )
              : Effect.succeed(saved),
          ),
        );
      };

      const close = (date: string) =>
        Effect.gen(function* () {
          const rows = yield* sql`
            update day_rating
            set closed_at = now(), updated_at = now()
            where entry_date = ${date}
              and closed_at is null
              and energy is not null
              and progress is not null
            returning energy, progress, repeat_day, rating_version, closed_at
          `.pipe(
            Effect.flatMap(decodeRatings),
            Effect.mapError(journalWriteError),
          );
          const [closed] = rows;
          if (closed !== undefined) {
            return { rating: closed, closedNow: true } satisfies DayClosing;
          }
          const current = yield* read(date);
          if (current.closedAt === null) {
            return yield* new JournalValidationError({
              message: ratingsNeededMessage,
            });
          }
          return { rating: current, closedNow: false } satisfies DayClosing;
        });

      /** Reopening an open day, or a day never rated, changes nothing. */
      const reopen = (date: string) =>
        sql`
          update day_rating
          set closed_at = null, updated_at = now()
          where entry_date = ${date} and closed_at is not null
        `.pipe(
          Effect.mapError(journalWriteError),
          Effect.flatMap(() => read(date)),
        );

      return { read, save, close, reopen } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(
    DayRatingRepository,
    DayRatingRepository.make,
  );
}
