import { readAfterSettlingBrowserAutosaves } from './browser-autosaves.ts';
import type { CalendarQueryParams } from './schemas/calendar-query.ts';
import type { CalendarView } from './services/calendar-fns.ts';

export const readCalendarRoute = (
  input: CalendarQueryParams,
): Promise<CalendarView> =>
  readAfterSettlingBrowserAutosaves(async () => {
    const { readCalendarFn } = await import('./services/calendar-fns.ts');
    return readCalendarFn({ data: input });
  });
