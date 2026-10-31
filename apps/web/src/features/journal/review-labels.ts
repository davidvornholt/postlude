import {
  energyOptions,
  progressOptions,
  repeatDayOptions,
} from './evening-labels.ts';
import { type JournalDate, journalDateWeekday } from './journal-day.ts';
import { journalNumberLabel, journalWeekdayLabel } from './journal-labels.ts';
import type { Energy, Progress, RepeatDay } from './schemas/day-rating.ts';

const minutesPerHour = 60;
const weekdayAbbreviationLength = 3;

export const durationLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / minutesPerHour);
  const rest = minutes % minutesPerHour;
  if (hours === 0) {
    return `${rest} min`;
  }
  const hourText = `${journalNumberLabel(hours)} h`;
  return rest === 0 ? hourText : `${hourText} ${rest} min`;
};

export const weekdayAbbreviation = (date: JournalDate): string =>
  journalWeekdayLabel(journalDateWeekday(date)).slice(
    0,
    weekdayAbbreviationLength,
  );

const labelIn = <Value extends string>(
  options: ReadonlyArray<{ readonly value: Value; readonly label: string }>,
  value: Value,
): string => options.find((option) => option.value === value)?.label ?? value;

export const energyLabel = (value: Energy): string =>
  labelIn(energyOptions, value);
export const progressLabel = (value: Progress): string =>
  labelIn(progressOptions, value);
export const repeatDayLabel = (value: RepeatDay): string =>
  labelIn(repeatDayOptions, value);
