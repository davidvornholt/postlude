/**
 * What the year and all-time pictures can be coloured by: how much was
 * written, or how the days were rated.
 *
 * Writing uses the green ramp the activity map already draws with, because
 * it runs from fewer words to more, and a ramp says "more" without a legend
 * having to.
 *
 * A rating takes the scale every rating shares instead: umber for the low
 * answer, ochre for the middle and green for the high, the colors the day
 * page gives a chosen answer. Three greens a step apart read as one in a
 * square this small, and a drained day should look the same kind of day as a
 * day of little progress, wherever either shows.
 *
 * A day without an answer is the outlined square in every picture, so a gap
 * never reads as the lowest answer.
 */

import { type HeatLevel, heatLevel, quartilesOf } from './activity.ts';
import {
  energyOptions,
  progressOptions,
  type RatingStep,
} from './evening-labels.ts';

export type InsightsMeasure = 'writing' | 'energy' | 'progress';

export const measureOptions = [
  { value: 'writing', label: 'Writing' },
  { value: 'energy', label: 'Energy' },
  { value: 'progress', label: 'Progress' },
] as const satisfies ReadonlyArray<{
  readonly value: InsightsMeasure;
  readonly label: string;
}>;

export type RatingMeasure = Exclude<InsightsMeasure, 'writing'>;

/**
 * What a square is filled with: a step of the writing ramp, or the step of
 * the rating scale a day's answer sits on.
 */
export type Shade = HeatLevel | RatingStep;

/** What a month's writing is weighed by: its words, over its days so far. */
export type MonthWriting = {
  readonly words: number;
  readonly elapsed: number;
};

const wordsPerDay = (month: MonthWriting): number =>
  month.elapsed === 0 ? 0 : month.words / month.elapsed;

/**
 * The ramp step of each month's writing, against the other months on show:
 * its words a day, written or not, split at the months' quartiles the way the
 * year splits its days. On a fixed scale every month of a journal kept most
 * days would take the darkest step and the picture would say nothing; split
 * on the months themselves, the darkest stay rare and a lighter month shows.
 */
export const monthWritingLevel = (
  months: ReadonlyArray<MonthWriting>,
): ((month: MonthWriting) => HeatLevel) => {
  const thresholds = quartilesOf(months.map(wordsPerDay));
  return (month) => heatLevel(wordsPerDay(month), thresholds);
};

/** The answers of a rating scale, lowest first, as the legend lists them. */
export const ratingAnswers = (
  measure: RatingMeasure,
): ReadonlyArray<{ readonly label: string; readonly shade: Shade }> =>
  (measure === 'energy' ? energyOptions : progressOptions).map((option) => ({
    label: option.label,
    shade: option.step,
  }));
