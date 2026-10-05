import { Schema } from 'effect';

import { isJournalMonth } from '../calendar.ts';
import { JournalDateSchema } from './entry.ts';

const JournalMonthSchema = Schema.String.check(
  Schema.makeFilter(isJournalMonth, { message: 'Invalid journal month' }),
);

export const CalendarQuery = Schema.Struct({
  day: Schema.optional(JournalDateSchema),
  month: Schema.optional(JournalMonthSchema),
});

export type CalendarQueryParams = Schema.Schema.Type<typeof CalendarQuery>;

export const decodeCalendarQuery = Schema.decodeUnknownSync(CalendarQuery);
