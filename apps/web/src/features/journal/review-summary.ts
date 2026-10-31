/**
 * What the review pages add up, and what they refuse to.
 *
 * Contract 4 of the personal-systems plan: a day measured under one metrics
 * version is not compared with a day measured under another, and a number that
 * was not measured is missing, never zero. So every total here is taken over
 * the days measured under a single version, the latest one the period holds,
 * and says how many days it covers and on how many it had nothing to read.
 */

import type { JournalDate } from './journal-day.ts';
import type { ReviewDay } from './review-view.ts';
import type { DayMetrics } from './schemas/day-metrics.ts';

/** Where a day stands for the numbers. */
export type MetricsState =
  /** After today, so nothing can be stored yet. */
  | 'upcoming'
  /** /wrap stored no report for the day. */
  | 'no-report'
  | 'measured';

export const metricsStateOf = (
  day: ReviewDay,
  today: JournalDate,
): MetricsState => {
  if (day.date > today) {
    return 'upcoming';
  }
  return day.metrics === null ? 'no-report' : 'measured';
};

/** The newest metrics version among the period's days, the one totals use. */
export const comparisonVersion = (
  days: ReadonlyArray<ReviewDay>,
): number | undefined => {
  const versions = days.flatMap((day) =>
    day.metrics === null ? [] : [day.metrics.metricsVersion],
  );
  return versions.length === 0 ? undefined : Math.max(...versions);
};

/** The days whose numbers can be added up together. */
export const comparableDays = (
  days: ReadonlyArray<ReviewDay>,
): ReadonlyArray<DayMetrics> => {
  const version = comparisonVersion(days);
  return days.flatMap((day) =>
    day.metrics !== null && day.metrics.metricsVersion === version
      ? [day.metrics]
      : [],
  );
};

/** The days measured under some other version, which totals leave out. */
export const otherVersionDays = (
  days: ReadonlyArray<ReviewDay>,
): ReadonlyArray<ReviewDay> => {
  const version = comparisonVersion(days);
  return days.filter(
    (day) => day.metrics !== null && day.metrics.metricsVersion !== version,
  );
};

/**
 * The positions where the metrics version changes from the measured day before.
 * A day without a report keeps the version it sits between, so a gap is not
 * mistaken for a change.
 */
export const versionChanges = (
  days: ReadonlyArray<ReviewDay>,
): ReadonlyArray<{ readonly index: number; readonly version: number }> => {
  const changes: Array<{ index: number; version: number }> = [];
  let previous: number | undefined;
  for (const [index, day] of days.entries()) {
    const version = day.metrics?.metricsVersion;
    if (version !== undefined) {
      if (previous !== undefined && version !== previous) {
        changes.push({ index, version });
      }
      previous = version;
    }
  }
  return changes;
};

export type Tally = {
  readonly total: number;
  /** Days whose value was measured and added in. */
  readonly measured: number;
  /** Comparable days whose value was not measured, left out of the total. */
  readonly missing: number;
};

export const tally = (
  metrics: ReadonlyArray<DayMetrics>,
  pick: (day: DayMetrics) => number | null,
): Tally => {
  const values = metrics.map(pick);
  const measured = values.filter((value) => value !== null);
  return {
    total: measured.reduce((sum, value) => sum + value, 0),
    measured: measured.length,
    missing: values.length - measured.length,
  };
};

/**
 * Mail sent from every mailbox on the day, or null unless each one was read.
 * A day that read no mailbox at all measured nothing, rather than zero mail.
 */
export const sentMailCount = (metrics: DayMetrics): number | null => {
  if (metrics.sentMails.length === 0) {
    return null;
  }
  let total = 0;
  for (const { count } of metrics.sentMails) {
    if (count === null) {
      return null;
    }
    total += count;
  }
  return total;
};

export type CategoryTotal = {
  readonly id: string;
  readonly label: string;
  /** Null when no day measured the category. */
  readonly minutes: number | null;
  /** Days that listed the category without being able to measure it. */
  readonly missing: number;
};

const addMinutes = (
  total: number | null | undefined,
  minutes: number | null,
): number | null =>
  minutes === null ? (total ?? null) : (total ?? 0) + minutes;

/**
 * Each category's minutes over the comparable days, largest first, and the
 * categories no day measured after them. Categories are /wrap's estimates of
 * active time, so a day whose active time was not measured adds nothing to any
 * of them. The label is the latest day's, in case a category was renamed inside
 * one version.
 */
export const categoryTotals = (
  metrics: ReadonlyArray<DayMetrics>,
): ReadonlyArray<CategoryTotal> => {
  const totals = new Map<string, CategoryTotal>();
  const measured = metrics.filter((day) => day.activeMinutes !== null);
  for (const day of measured) {
    for (const category of day.categories) {
      const current = totals.get(category.id);
      totals.set(category.id, {
        id: category.id,
        label: category.label,
        minutes: addMinutes(current?.minutes, category.minutes),
        missing: (current?.missing ?? 0) + (category.minutes === null ? 1 : 0),
      });
    }
  }
  return [...totals.values()].sort(
    (first, second) =>
      (second.minutes ?? -1) - (first.minutes ?? -1) ||
      first.label.localeCompare(second.label),
  );
};

/** How many past days carry each rating, and how many carry none. */
export const ratingCounts = <Level extends string>(
  days: ReadonlyArray<ReviewDay>,
  today: JournalDate,
  levels: ReadonlyArray<Level>,
  pick: (day: ReviewDay) => Level | null,
): {
  readonly counts: ReadonlyMap<Level, number>;
  readonly unrated: number;
} => {
  const counts = new Map(levels.map((level) => [level, 0]));
  let unrated = 0;
  for (const day of days.filter((past) => past.date <= today)) {
    const level = pick(day);
    if (level === null) {
      unrated += 1;
    } else {
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
  }
  return { counts, unrated };
};
