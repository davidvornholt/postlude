/**
 * What the review charts say about the day in focus, in words. The charts are
 * pictures for sighted readers, so this line is what a screen reader hears and
 * what anyone reads when a bar is too small to judge.
 */

import {
  energyOptions,
  progressOptions,
  repeatDayOptions,
} from './evening-labels.ts';
import type { JournalDate } from './journal-day.ts';
import {
  durationLabel,
  energyLabel,
  progressLabel,
  repeatDayLabel,
} from './review-labels.ts';
import { metricsStateOf, screenTimeSplit } from './review-summary.ts';
import type { ReviewDay } from './review-view.ts';

export type RatingScale = {
  readonly name: string;
  readonly short: string;
  /** How many answers the scale has, one step of the meter each. */
  readonly steps: number;
  /** How many steps a day's rating fills, or null when it has none. */
  readonly filled: (day: ReviewDay) => number | null;
  readonly said: (day: ReviewDay) => string;
};

const stepOf = <Value extends string>(
  options: ReadonlyArray<{ readonly value: Value }>,
  value: Value | null,
): number | null =>
  value === null
    ? null
    : options.findIndex((option) => option.value === value) + 1;

/** The three ratings, each read as steps from the low end to the high end. */
export const ratingScales: ReadonlyArray<RatingScale> = [
  {
    name: 'Energy',
    short: 'Energy',
    steps: energyOptions.length,
    filled: (day) => stepOf(energyOptions, day.energy),
    said: (day) =>
      day.energy === null ? 'not rated' : energyLabel(day.energy),
  },
  {
    name: 'Progress',
    short: 'Progress',
    steps: progressOptions.length,
    filled: (day) => stepOf(progressOptions, day.progress),
    said: (day) =>
      day.progress === null ? 'not rated' : progressLabel(day.progress),
  },
  {
    name: 'Would repeat',
    short: 'Repeat',
    steps: repeatDayOptions.length,
    // The options run from yes to no, and yes is the high end.
    filled: (day) => {
      const step = stepOf(repeatDayOptions, day.repeatDay);
      return step === null ? null : repeatDayOptions.length + 1 - step;
    },
    said: (day) =>
      day.repeatDay === null ? 'not rated' : repeatDayLabel(day.repeatDay),
  },
];

/** What the ratings chart's details line says about one day. */
export const ratingDetails = (day: ReviewDay, today: JournalDate): string => {
  if (day.date > today) {
    return 'Still to come';
  }
  const ratings = ratingScales.map(
    (scale) => `${scale.name}: ${scale.said(day)}`,
  );
  return [...ratings, day.closed ? 'Closed' : 'Not closed'].join(' · ');
};

/** What the screen time chart's details line says about one day. */
export const screenTimeDetails = (
  day: ReviewDay,
  today: JournalDate,
): string => {
  const state = metricsStateOf(day, today);
  if (state === 'upcoming') {
    return 'Still to come';
  }
  const { metrics } = day;
  if (metrics === null) {
    return 'No report';
  }
  const {
    activeMinutes: active,
    focusMinutes: focus,
    scatteredMinutes: scattered,
  } = metrics;
  if (active === null) {
    return 'Screen time not measured';
  }
  const total = `${durationLabel(active)} at the screen`;
  if (focus === null || scattered === null) {
    return `${total} · focus not measured`;
  }
  const split = screenTimeSplit(metrics);
  if (split === undefined) {
    return `${total} · ${durationLabel(focus)} focused and ${durationLabel(scattered)} scattered, more than the screen time`;
  }
  return [
    total,
    `${durationLabel(focus)} focused`,
    `${durationLabel(scattered)} scattered`,
    ...(split.rest === 0 ? [] : [`${durationLabel(split.rest)} not split`]),
  ].join(' · ');
};
