/**
 * A range of days as Insights reads them: how much was written, how the days
 * were rated, and what the day metrics measured, and nothing that was written.
 */

import type { CategoryTotal, DayMeasures } from './day-measures.ts';
import type { InsightsRange } from './insights-range.ts';
import type { JournalDate } from './journal-day.ts';
import type { Energy, Progress, RepeatDay } from './schemas/day-rating.ts';
import type { Streak } from './streaks.ts';

export type InsightsDay = {
  readonly date: JournalDate;
  readonly journalWords: number;
  readonly scriptureWords: number;
  /** Whether the morning noted a passage or a topic. */
  readonly hasScripture: boolean;
  /** The book of the morning's passage, by its canonical English name. */
  readonly scriptureBook: string | null;
  readonly energy: Energy | null;
  readonly progress: Progress | null;
  readonly repeatDay: RepeatDay | null;
  readonly closed: boolean;
  /** Null when /wrap stored no report for the day. */
  readonly metrics: DayMeasures | null;
};

export type InsightsView = {
  readonly range: InsightsRange;
  /** The server's journal day, so the days after it read as still to come. */
  readonly today: JournalDate;
  /** The first day with writing, a rating or a report, or undefined before any. */
  readonly earliest: JournalDate | undefined;
  /** Every day of the range, in order, whether or not anything is stored. */
  readonly days: ReadonlyArray<InsightsDay>;
  /** Screen time by category over the range's comparable days. */
  readonly categories: ReadonlyArray<CategoryTotal>;
  /** Counted over the whole journal: a run is the one the writer is on. */
  readonly journalStreak: Streak;
  readonly scriptureStreak: Streak;
  /** Stored source exists even when no day shows any writing. */
  readonly exportAvailable: boolean;
};
