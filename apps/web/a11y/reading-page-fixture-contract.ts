import type { JournalDate } from '../src/features/journal/journal-day.ts';
import type { CalendarView } from '../src/features/journal/services/calendar-fns.ts';
import type { OnThisDayView } from '../src/features/journal/services/on-this-day-fns.ts';

export type ReadingPageFixtureConfig =
  | {
      readonly kind: 'calendar';
      readonly requestedDay: JournalDate;
      readonly view: CalendarView;
    }
  | {
      readonly kind: 'on-this-day';
      readonly view: OnThisDayView;
    };

export type ReadingPageFixtureWindow = Window & {
  postludeReadingPageFixture: ReadingPageFixtureConfig;
};
