import { ActionLink } from '#/shared/ui/action-link.tsx';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import {
  datesInMonth,
  type JournalMonth,
  journalMonthLabel,
  journalMonthOf,
  shiftJournalMonth,
} from '../calendar.ts';
import { type JournalDate, latestJournalDate } from '../journal-day.ts';
import { pageTurn } from '../page-turn.ts';
import type { CalendarView } from '../services/calendar-fns.ts';
import { CalendarGrid } from './calendar-grid.tsx';
import { CalendarPreview } from './calendar-preview.tsx';
import {
  PeriodHeading,
  type StepDirection,
  StepGlyph,
  UnavailableStep,
} from './period-heading.tsx';

const MonthStep = ({
  direction,
  month,
}: {
  readonly direction: StepDirection;
  readonly month: JournalMonth | undefined;
}) => {
  const label = direction < 0 ? 'Previous month' : 'Next month';
  return month === undefined ? (
    <UnavailableStep direction={direction} label={label} />
  ) : (
    <ActionLink
      aria-label={label}
      search={{ month }}
      to="/calendar"
      variant="icon"
      viewTransition={pageTurn}
    >
      <StepGlyph direction={direction} />
    </ActionLink>
  );
};

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
      <header>
        <PeriodHeading
          line={
            view.month === journalMonthOf(view.today) ? null : (
              <ActionLink
                search={{ day: view.today, month: journalMonthOf(view.today) }}
                to="/calendar"
                variant="quiet"
                viewTransition={pageTurn}
              >
                Go to today
              </ActionLink>
            )
          }
          steps={
            <>
              <MonthStep direction={-1} month={previous} />
              <MonthStep direction={1} month={next} />
            </>
          }
        >
          {journalMonthLabel(view.month)}
        </PeriodHeading>
      </header>
      <div className="mt-4 grid gap-10 lg:grid-cols-4 lg:gap-12">
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
