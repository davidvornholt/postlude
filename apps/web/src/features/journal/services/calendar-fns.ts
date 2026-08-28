import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import {
  datesInMonth,
  type JournalMonth,
  journalMonthOf,
} from '../calendar.ts';
import type { JournalDate } from '../journal-day.ts';
import { decodeCalendarQuery } from '../schemas/calendar-query.ts';
import type { EntryPreview } from '../schemas/entry-preview.ts';
import { archiveSnippet } from '../snippet.ts';
import { EntryRepository } from './entry-repository.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

export type CalendarDay = {
  readonly date: JournalDate;
  readonly hasScriptureReference: boolean;
  readonly revision: number;
  readonly snippet: string;
  readonly words: number;
};

export type CalendarView = {
  readonly days: ReadonlyArray<CalendarDay>;
  readonly earliest: JournalDate | undefined;
  readonly month: JournalMonth;
  readonly today: JournalDate;
};

const calendarDayOf = (entry: EntryPreview): CalendarDay => ({
  date: entry.date,
  hasScriptureReference: entry.hasScriptureReference,
  revision: entry.revision,
  snippet: archiveSnippet(entry),
  words: entry.journalWordCount + entry.scriptureWordCount,
});

export const readCalendarFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeCalendarQuery(input ?? {}))
  .handler(({ data }): Promise<CalendarView> => {
    const today = currentJournalDate();
    const currentMonth = journalMonthOf(today);
    const requested =
      data.month ??
      (data.day === undefined ? currentMonth : journalMonthOf(data.day));
    const month = requested;
    const dates = datesInMonth(month);
    const [from] = dates;
    const last = dates.at(-1);
    if (from === undefined || last === undefined) {
      throw new Error('The calendar month has no days.');
    }

    return runJournalEffect(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const calendar = yield* entries.readCalendar({
          from,
          to: last,
          today,
        });
        return {
          today,
          month,
          earliest: calendar.earliest,
          days: calendar.entries.map(calendarDayOf),
        };
      }),
    );
  });
