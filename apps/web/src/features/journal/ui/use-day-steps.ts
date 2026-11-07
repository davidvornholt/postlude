import { useNavigate } from '@tanstack/react-router';
import { dayTransition } from '../day-transition.ts';
import {
  earliestJournalDate,
  type JournalDate,
  latestJournalDate,
  shiftJournalDate,
} from '../journal-day.ts';
import { useStepKeys } from './use-step-keys.ts';

export const useDaySteps = (date: JournalDate, today: JournalDate) => {
  const navigate = useNavigate();
  // Today keeps its canonical plain URL, as it does in `DayLink`. A key or the
  // calendar has no link to fall back on, so a move the router can't make
  // loads the day as a page instead.
  const openDay = (chosen: JournalDate): void => {
    const viewTransition = dayTransition(date, chosen);
    const moving =
      chosen === today
        ? navigate({ to: '/', viewTransition })
        : navigate({
            params: { date: chosen },
            to: '/day/$date',
            viewTransition,
          });
    moving.catch(() =>
      globalThis.location.assign(chosen === today ? '/' : `/day/${chosen}`),
    );
  };
  const previous =
    date === earliestJournalDate ? undefined : shiftJournalDate(date, -1);
  const next =
    date === latestJournalDate ? undefined : shiftJournalDate(date, 1);
  const stepTo = (step: JournalDate | undefined) =>
    step === undefined ? undefined : () => openDay(step);
  useStepKeys({ previous: stepTo(previous), next: stepTo(next) });
  return { next, openDay, previous };
};
