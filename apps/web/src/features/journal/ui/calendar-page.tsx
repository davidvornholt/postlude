import { Link } from '@tanstack/react-router';

import { pageFrameClass } from '#/shared/ui/design-classes.ts';
import { iconButtonClass, quietButtonClass } from '#/shared/ui/form-classes.ts';
import {
  datesInMonth,
  journalMonthLabel,
  journalMonthOf,
  shiftJournalMonth,
} from '../calendar.ts';
import { type JournalDate, latestJournalDate } from '../journal-day.ts';
import type { CalendarView } from '../services/calendar-fns.ts';
import { CalendarGrid } from './calendar-grid.tsx';
import { CalendarPreview } from './calendar-preview.tsx';

const selectedDate = (
  view: CalendarView,
  requested: JournalDate | undefined,
): JournalDate => {
  if (requested !== undefined && journalMonthOf(requested) === view.month) {
    return requested;
  }
  if (journalMonthOf(view.today) === view.month) {
    return view.today;
  }
  return (
    view.days.at(-1)?.date ?? datesInMonth(view.month).at(-1) ?? view.today
  );
};

export const CalendarPage = ({
  requestedDay,
  view,
}: {
  readonly requestedDay: JournalDate | undefined;
  readonly view: CalendarView;
}) => {
  const selected = selectedDate(view, requestedDay);
  const day = view.days.find((entry) => entry.date === selected);
  const earliestMonth =
    view.earliest === undefined
      ? journalMonthOf(view.today)
      : journalMonthOf(view.earliest);
  const previousCandidate = shiftJournalMonth(view.month, -1);
  const previous =
    previousCandidate !== undefined && previousCandidate >= earliestMonth
      ? previousCandidate
      : undefined;
  const nextCandidate = shiftJournalMonth(view.month, 1);
  const next =
    nextCandidate !== undefined &&
    nextCandidate <= journalMonthOf(latestJournalDate)
      ? nextCandidate
      : undefined;

  return (
    <div className={pageFrameClass}>
      <header className="flex flex-wrap items-center gap-4">
        {previous === undefined ? (
          <span aria-hidden="true" className="size-11" />
        ) : (
          <Link
            aria-label="Previous month"
            className={iconButtonClass}
            search={{ month: previous }}
            to="/calendar"
          >
            ←
          </Link>
        )}
        <h1 className="text-balance font-display text-4xl text-ink sm:text-5xl">
          {journalMonthLabel(view.month)}
        </h1>
        {next === undefined ? null : (
          <Link
            aria-label="Next month"
            className={iconButtonClass}
            search={{ month: next }}
            to="/calendar"
          >
            →
          </Link>
        )}
        {view.month === journalMonthOf(view.today) ? null : (
          <Link
            className={[quietButtonClass, 'ml-2'].join(' ')}
            search={{ day: view.today, month: journalMonthOf(view.today) }}
            to="/calendar"
          >
            Today
          </Link>
        )}
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-4 lg:gap-12">
        <div className="min-w-0 lg:col-span-3">
          <CalendarGrid
            days={view.days}
            month={view.month}
            selected={selected}
            today={view.today}
          />
        </div>
        <div>
          <CalendarPreview day={day} selected={selected} today={view.today} />
        </div>
      </div>
    </div>
  );
};
