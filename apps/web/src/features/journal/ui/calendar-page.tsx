import { ActionLink } from '#/shared/ui/action-link.tsx';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
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
    <PageFrame>
      <header className="flex flex-wrap items-center gap-4">
        {previous === undefined ? (
          <span aria-hidden="true" className="size-11" />
        ) : (
          <ActionLink
            aria-label="Previous month"
            variant="icon"
            search={{ month: previous }}
            to="/calendar"
          >
            ←
          </ActionLink>
        )}
        <h1 className="text-balance font-display text-4xl text-ink sm:text-5xl">
          {journalMonthLabel(view.month)}
        </h1>
        {next === undefined ? null : (
          <ActionLink
            aria-label="Next month"
            variant="icon"
            search={{ month: next }}
            to="/calendar"
          >
            →
          </ActionLink>
        )}
        {view.month === journalMonthOf(view.today) ? null : (
          <ActionLink
            variant="quiet"
            className="ml-2"
            search={{ day: view.today, month: journalMonthOf(view.today) }}
            to="/calendar"
          >
            Today
          </ActionLink>
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
    </PageFrame>
  );
};
