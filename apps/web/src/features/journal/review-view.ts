/**
 * One week or month of days as the review pages read them: the ratings and the
 * day metrics, and nothing that was written.
 */

import type { JournalDate } from './journal-day.ts';
import type { ReviewPeriod } from './review-period.ts';
import type { DayMetrics } from './schemas/day-metrics.ts';
import type { Energy, Progress, RepeatDay } from './schemas/day-rating.ts';

export type ReviewDay = {
  readonly date: JournalDate;
  readonly energy: Energy | null;
  readonly progress: Progress | null;
  readonly repeatDay: RepeatDay | null;
  readonly closed: boolean;
  /** Null when /wrap stored no report for the day. */
  readonly metrics: DayMetrics | null;
};

export type ReviewView = {
  readonly period: ReviewPeriod;
  /** The server's journal day, so the days after it read as still to come. */
  readonly today: JournalDate;
  /** Every day of the period, in order, whether or not anything is stored. */
  readonly days: ReadonlyArray<ReviewDay>;
};
