import { readCalendarRoute } from './browser-calendar-navigation.ts';
import type { JournalMonth } from './calendar.ts';
import type { JournalDate } from './journal-day.ts';

/**
 * The days of a month that have writing, for the calendar under a day's date.
 * It asks for the same month the calendar page shows, after any writing still
 * on its way has landed, so the day being written counts once it is saved.
 */
export const readWrittenDays = async (
  month: JournalMonth,
): Promise<ReadonlyArray<JournalDate>> =>
  (await readCalendarRoute({ month })).days.map((day) => day.date);
