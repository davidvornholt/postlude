/**
 * Every view that shows a rating takes its words from here, and the step of
 * the shared rating scale each answer is drawn in, so a scale reads the same
 * everywhere.
 */

import type { Energy, Progress, RepeatDay } from './schemas/day-rating.ts';

/**
 * Where an answer sits on its scale. Every rating has three answers, and the
 * three steps are the colors they wear, the same for every scale: drained,
 * little and no are low; fresh, a lot and yes are high.
 */
export type RatingStep = 'low' | 'middle' | 'high';

/** The steps from the low end, as a meter fills them. */
export const ratingSteps: ReadonlyArray<RatingStep> = ['low', 'middle', 'high'];

export type RatingOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly step: RatingStep;
};

export const energyOptions: ReadonlyArray<RatingOption<Energy>> = [
  { value: 'drained', label: 'Drained', step: 'low' },
  { value: 'okay', label: 'Okay', step: 'middle' },
  { value: 'fresh', label: 'Fresh', step: 'high' },
];

export const progressOptions: ReadonlyArray<RatingOption<Progress>> = [
  { value: 'little', label: 'Little', step: 'low' },
  { value: 'solid', label: 'Solid', step: 'middle' },
  { value: 'a_lot', label: 'A lot', step: 'high' },
];

/** Listed as the evening asks it, yes first, so its steps run high to low. */
export const repeatDayOptions: ReadonlyArray<RatingOption<RepeatDay>> = [
  { value: 'yes', label: 'Yes', step: 'high' },
  { value: 'partly', label: 'Partly', step: 'middle' },
  { value: 'no', label: 'No', step: 'low' },
];

/** The step an answer is drawn in, or null for a day without one. */
export const ratingStepOf = <Value extends string>(
  options: ReadonlyArray<RatingOption<Value>>,
  value: Value | null,
): RatingStep | null =>
  value === null
    ? null
    : (options.find((option) => option.value === value)?.step ?? null);
