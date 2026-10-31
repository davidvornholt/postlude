import { Schema } from 'effect';

import { JournalMonthSchema } from './calendar-query.ts';
import { JournalDateSchema } from './entry.ts';

/** `/review/week?week=…`: any day of the week, read as the week's Monday. */
export const WeekReviewSearch = Schema.Struct({
  week: Schema.optional(JournalDateSchema),
});

export type WeekReviewSearchParams = Schema.Schema.Type<
  typeof WeekReviewSearch
>;

/** `/review/month?month=2026-10`. */
export const MonthReviewSearch = Schema.Struct({
  month: Schema.optional(JournalMonthSchema),
});

export type MonthReviewSearchParams = Schema.Schema.Type<
  typeof MonthReviewSearch
>;

export const ReviewQuery = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('week'),
    week: Schema.optional(JournalDateSchema),
  }),
  Schema.Struct({
    kind: Schema.Literal('month'),
    month: Schema.optional(JournalMonthSchema),
  }),
]);

export type ReviewQueryParams = Schema.Schema.Type<typeof ReviewQuery>;

export const decodeReviewQuery = Schema.decodeUnknownSync(ReviewQuery);
