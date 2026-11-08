import type { JournalDate } from '../src/features/journal/journal-day.ts';
import type { CalendarView } from '../src/features/journal/services/calendar-fns.ts';

export type ReadingPageFixtureConfig = {
  readonly requestedDay: JournalDate;
  readonly view: CalendarView;
};

export type ReadingPageFixtureWindow = Window & {
  postludeReadingPageFixture: ReadingPageFixtureConfig;
};
