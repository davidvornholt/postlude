/**
 * What the year and all-time pictures can be coloured by: how much was
 * written, or how the days were rated.
 *
 * Writing and progress use the one green ramp the activity map already draws
 * with, because each runs from less to more — fewer words, less progress —
 * and a ramp says "more" without a legend having to. A rating spans three
 * steps and the ramp four: little takes the lightest step and a lot the
 * darkest, with some on the lighter of the two between, so the end a writer
 * hopes for stands out most.
 *
 * Energy is not more or less of one thing: a drained day, an okay one and a
 * fresh one are three kinds of day, and three greens a step apart read as one
 * in a square this small. Each answer has a color of its own instead, which
 * the theme keeps apart for every common kind of color vision.
 *
 * A day without an answer is the outlined square in every picture, so a gap
 * never reads as the lowest answer.
 */

import { type HeatLevel, heatLevel, quartilesOf } from './activity.ts';
import { energyOptions, progressOptions } from './evening-labels.ts';
import type { Energy, Progress } from './schemas/day-rating.ts';

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
 * An answer's place on its scale, from 1 at the low end, read from the order
 * the evening lists the answers in.
 */
const scoreIn = <Answer extends string>(
  options: ReadonlyArray<{ readonly value: Answer }>,
  answer: Answer,
): number => options.findIndex((option) => option.value === answer) + 1;

export const energyScore = (energy: Energy): number =>
  scoreIn(energyOptions, energy);

export const progressScore = (progress: Progress): number =>
  scoreIn(progressOptions, progress);

/**
 * What a square is filled with: a step of the ramp, or an energy answer's own
 * color.
 */
export type Shade = HeatLevel | Energy;

/** The ramp step for each score, the lowest score at the lightest step. */
const scoreLevels: ReadonlyArray<HeatLevel> = ['none', 'q1', 'q2', 'q4'];

/** The ramp step a single day's answer takes, or none when it has none. */
export const ratingLevel = (score: number | null): HeatLevel =>
  score === null ? 'none' : (scoreLevels[score] ?? 'none');

const lowAverage = 1.5;
const middleAverage = 2;
const highAverage = 2.5;

/**
 * The ramp step an average answer takes, for a month of rated days. A month
 * of nothing but some days takes the step a single such day does, and only a
 * month leaning toward the top of the scale reaches the steps above it.
 */
export const averageLevel = (average: number | undefined): HeatLevel => {
  if (average === undefined) {
    return 'none';
  }
  if (average < lowAverage) {
    return 'q1';
  }
  if (average <= middleAverage) {
    return 'q2';
  }
  return average < highAverage ? 'q3' : 'q4';
};

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
  measure === 'energy'
    ? energyOptions.map((option) => ({
        label: option.label,
        shade: option.value,
      }))
    : progressOptions.map((option) => ({
        label: option.label,
        shade: ratingLevel(progressScore(option.value)),
      }));
