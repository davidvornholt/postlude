/**
 * Browser-only evidence that a save reached the database.
 *
 * A route loader can start before that save finishes and return afterwards. Its
 * row is then older than the save response even though it arrived later. The
 * tracker keeps only a day and its numeric revision, never journal prose, and
 * bounds the long-session set by discarding the oldest comparison.
 */

import type { JournalDate } from './journal-day.ts';

export type ConfirmedRevisionTracker = {
  readonly record: (date: JournalDate, revision: number) => void;
  readonly known: (date: JournalDate) => number | undefined;
  readonly observe: (date: JournalDate, revision: number) => void;
};

const maximumTrackedDays = 32;
const maximumLoaderReads = 3;

export const createConfirmedRevisionTracker = (
  maximum = maximumTrackedDays,
): ConfirmedRevisionTracker => {
  const revisions = new Map<JournalDate, number>();

  return {
    record: (date, revision) => {
      const current = revisions.get(date) ?? 0;
      revisions.delete(date);
      revisions.set(date, Math.max(current, revision));
      while (revisions.size > maximum) {
        const oldest = revisions.keys().next().value;
        if (oldest === undefined) {
          return;
        }
        revisions.delete(oldest);
      }
    },
    known: (date) => revisions.get(date),
    observe: (date, revision) => {
      const confirmed = revisions.get(date);
      if (confirmed !== undefined && revision >= confirmed) {
        revisions.delete(date);
      }
    },
  };
};

export const confirmedRevisions = createConfirmedRevisionTracker();

type RevisionedJournalDay = {
  readonly entry: {
    readonly date: JournalDate;
    readonly revision: number;
  };
};

/** Repeat bounded loader reads while their snapshots predate confirmed saves. */
export const loadAfterConfirmedRevision = <Day extends RevisionedJournalDay>(
  load: () => Promise<Day>,
  tracker: ConfirmedRevisionTracker = confirmedRevisions,
): Promise<Day> => {
  const readCurrent = async (remaining: number): Promise<Day> => {
    const loaded = await load();
    const confirmed = tracker.known(loaded.entry.date);
    if (confirmed === undefined || loaded.entry.revision >= confirmed) {
      tracker.observe(loaded.entry.date, loaded.entry.revision);
      return loaded;
    }
    if (remaining === 1) {
      throw new Error(
        'Fresh journal reads did not include the confirmed save.',
      );
    }
    return readCurrent(remaining - 1);
  };

  return readCurrent(maximumLoaderReads);
};
