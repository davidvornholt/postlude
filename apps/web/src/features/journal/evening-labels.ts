/**
 * The ratings' words, in the order each scale runs. Every view that shows a
 * rating takes its words from here, so a scale reads the same on the day page
 * and in the weeks and months.
 */

import type { Energy, Progress, RepeatDay } from './schemas/day-rating.ts';

export const energyOptions: ReadonlyArray<{
  readonly value: Energy;
  readonly label: string;
}> = [
  { value: 'drained', label: 'Drained' },
  { value: 'okay', label: 'Okay' },
  { value: 'fresh', label: 'Fresh' },
];

export const progressOptions: ReadonlyArray<{
  readonly value: Progress;
  readonly label: string;
}> = [
  { value: 'little', label: 'Little' },
  { value: 'solid', label: 'Solid' },
  { value: 'a_lot', label: 'A lot' },
];

export const repeatDayOptions: ReadonlyArray<{
  readonly value: RepeatDay;
  readonly label: string;
}> = [
  { value: 'yes', label: 'Yes' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'No' },
];
