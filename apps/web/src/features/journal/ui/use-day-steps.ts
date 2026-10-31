import { useNavigate } from '@tanstack/react-router';
import {
  earliestJournalDate,
  type JournalDate,
  latestJournalDate,
  shiftJournalDate,
} from '../journal-day.ts';
import { useStepKeys } from './use-step-keys.ts';

export const useDaySteps = (date: JournalDate, today: JournalDate) => {
  const navigate = useNavigate();
  // Today keeps its canonical plain URL, as it does in `DayLink`.
  const openDay = (chosen: JournalDate) =>
    chosen === today
      ? navigate({ to: '/' })
      : navigate({ params: { date: chosen }, to: '/day/$date' });
  const previous =
    date === earliestJournalDate ? undefined : shiftJournalDate(date, -1);
  const next =
    date === latestJournalDate ? undefined : shiftJournalDate(date, 1);
  // A key has no link to fall back on, so a move the router can't make loads
  // the day as a page instead.
  const stepTo = (step: JournalDate | undefined) =>
    step === undefined
      ? undefined
      : () => {
          openDay(step).catch(() =>
            globalThis.location.assign(step === today ? '/' : `/day/${step}`),
          );
        };
  useStepKeys({ previous: stepTo(previous), next: stepTo(next) });
  return { next, openDay, previous };
};
