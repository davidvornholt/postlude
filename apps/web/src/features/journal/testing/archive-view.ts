/**
 * An archive to render, for the tests that show one. The journal it is drawn
 * from comes from `sampleJournal`.
 */

import {
  type ActivityDay,
  activityTotals,
  activityWindow,
} from '../activity.ts';
import type { JournalDate } from '../journal-day.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { journalStreak, scriptureStreak } from '../streaks.ts';

const isoYearEnd = 4;

/**
 * The whole view, assembled by the same functions the server function uses, so
 * a test renders a consistent archive rather than one whose streaks disagree
 * with its map.
 */
export const sampleArchiveView = (
  days: ReadonlyArray<ActivityDay>,
  today: JournalDate,
): ArchiveView => {
  const window = activityWindow(today);
  return {
    today,
    exportAvailable: days.length > 0,
    window,
    days,
    years: [Number(today.slice(0, isoYearEnd))],
    journalStreak: journalStreak(days, today),
    scriptureStreak: scriptureStreak(days, today),
    totals: activityTotals(days),
  };
};
