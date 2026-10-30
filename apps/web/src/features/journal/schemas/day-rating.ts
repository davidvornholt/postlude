/**
 * David's three ratings of a day and whether he closed it.
 *
 * The scales are the database's check constraints spelled as schemas, so a
 * value the table would refuse is refused before a query is sent. A day that
 * was never rated has every field empty, the same as a day rated and then
 * cleared.
 */

import { Schema } from 'effect';

import { JournalDateSchema } from './entry.ts';

export const EnergySchema = Schema.Literals(['drained', 'okay', 'fresh']);
export const ProgressSchema = Schema.Literals(['little', 'solid', 'a_lot']);
export const RepeatDaySchema = Schema.Literals(['yes', 'partly', 'no']);

export type Energy = Schema.Schema.Type<typeof EnergySchema>;
export type Progress = Schema.Schema.Type<typeof ProgressSchema>;
export type RepeatDay = Schema.Schema.Type<typeof RepeatDaySchema>;

/** The version of the three scales above, stored with every rating saved. */
export const currentRatingVersion = 1;

const RatingVersionSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

export const DayRatingSchema = Schema.Struct({
  energy: Schema.NullOr(EnergySchema),
  progress: Schema.NullOr(ProgressSchema),
  repeatDay: Schema.NullOr(RepeatDaySchema),
  /** Null until a rating is first saved for the day. */
  ratingVersion: Schema.NullOr(RatingVersionSchema),
  /** When David closed the day, or null while it is open. */
  closedAt: Schema.NullOr(Schema.Date),
});

export type DayRating = Schema.Schema.Type<typeof DayRatingSchema>;

/** A row of `day_rating`, under the column names Postgres returns. */
export const DayRatingFromRow = DayRatingSchema.pipe(
  Schema.encodeKeys({
    repeatDay: 'repeat_day',
    ratingVersion: 'rating_version',
    closedAt: 'closed_at',
  }),
);

export const emptyDayRating: DayRating = {
  energy: null,
  progress: null,
  repeatDay: null,
  ratingVersion: null,
  closedAt: null,
};

export const canCloseDay = (rating: DayRating): boolean =>
  rating.energy !== null && rating.progress !== null;

/**
 * One or more ratings to save. A key that is absent keeps its stored value, and
 * null clears it, so the page can save each rating as it is chosen.
 */
export const DayRatingChangeSchema = Schema.Struct({
  date: JournalDateSchema,
  energy: Schema.optionalKey(Schema.NullOr(EnergySchema)),
  progress: Schema.optionalKey(Schema.NullOr(ProgressSchema)),
  repeatDay: Schema.optionalKey(Schema.NullOr(RepeatDaySchema)),
});

export type DayRatingChange = Schema.Schema.Type<typeof DayRatingChangeSchema>;

export const DayInputSchema = Schema.Struct({ date: JournalDateSchema });
