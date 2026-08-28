import { Schema } from 'effect';

import { isJournalMonth, type JournalMonth } from '../calendar.ts';
import { JournalDateSchema } from './entry.ts';

const JournalMonthSchema = Schema.String.pipe(
  Schema.filter(isJournalMonth, { message: () => 'Invalid journal month' }),
) as Schema.Schema<JournalMonth>;

export const CalendarQuery = Schema.Struct({
  day: Schema.optional(JournalDateSchema),
  month: Schema.optional(JournalMonthSchema),
});

export type CalendarQueryParams = Schema.Schema.Type<typeof CalendarQuery>;

export const decodeCalendarQuery = Schema.decodeUnknownSync(CalendarQuery);
