/**
 * What the day-by-day charts on Insights say about the day in focus, in
 * words. The charts are pictures for sighted readers, so this line is what a
 * screen reader hears and what anyone reads when a bar is too small to judge.
 */

import { metricsStateOf, screenTimeSplit } from './day-measures.ts';
import {
  energyOptions,
  progressOptions,
  type RatingStep,
  ratingStepOf,
  repeatDayOptions,
} from './evening-labels.ts';
import {
  durationLabel,
  energyLabel,
  progressLabel,
  repeatDayLabel,
} from './insights-labels.ts';
import type { InsightsDay } from './insights-view.ts';
import type { JournalDate } from './journal-day.ts';

export type RatingScale = {
  readonly name: string;
  readonly short: string;
  /**
   * Where the day's answer sits on the scale every rating shares, which sets
   * both how far its meter fills and the color it fills in; null when the
   * day has no answer.
   */
  readonly step: (day: InsightsDay) => RatingStep | null;
  readonly said: (day: InsightsDay) => string;
};

export const ratingScales: ReadonlyArray<RatingScale> = [
  {
    name: 'Energy',
    short: 'Energy',
    step: (day) => ratingStepOf(energyOptions, day.energy),
    said: (day) =>
      day.energy === null ? 'not rated' : energyLabel(day.energy),
  },
  {
    name: 'Progress',
    short: 'Progress',
    step: (day) => ratingStepOf(progressOptions, day.progress),
    said: (day) =>
      day.progress === null ? 'not rated' : progressLabel(day.progress),
  },
  {
    name: 'Would repeat',
    short: 'Repeat',
    step: (day) => ratingStepOf(repeatDayOptions, day.repeatDay),
    said: (day) =>
      day.repeatDay === null ? 'not rated' : repeatDayLabel(day.repeatDay),
  },
];

export const ratingDetails = (day: InsightsDay, today: JournalDate): string => {
  if (day.date > today) {
    return 'Still to come';
  }
  const ratings = ratingScales.map(
    (scale) => `${scale.name}: ${scale.said(day)}`,
  );
  return [...ratings, day.closed ? 'Closed' : 'Not closed'].join(' · ');
};

export const screenTimeDetails = (
  day: InsightsDay,
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
    scatteredMinutes: shortStretches,
  } = metrics;
  if (active === null) {
    return 'Screen time not measured';
  }
  const total = `${durationLabel(active)} at the screen`;
  if (focus === null || shortStretches === null) {
    return `${total} · focus not measured`;
  }
  const split = screenTimeSplit(metrics);
  if (split === undefined) {
    return `${total} · ${durationLabel(focus)} focused and ${durationLabel(shortStretches)} in short stretches, more than the screen time`;
  }
  return [
    total,
    `${durationLabel(focus)} focused`,
    `${durationLabel(shortStretches)} in short stretches`,
    ...(split.rest === 0 ? [] : [`${durationLabel(split.rest)} not split`]),
  ].join(' · ');
};
