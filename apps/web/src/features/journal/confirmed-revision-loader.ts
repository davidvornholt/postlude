import {
  type ConfirmedRevisionTracker,
  confirmedRevisions,
} from './confirmed-revisions.ts';
import type { JournalDate } from './journal-day.ts';

type RevisionEvidence = {
  readonly date: JournalDate;
  readonly revision: number;
};

type RevisionedJournalDay = {
  readonly entry: RevisionEvidence;
  readonly anniversaryRevisions: ReadonlyArray<RevisionEvidence>;
};

const maximumLoaderReads = 3;

export const loadAfterConfirmedRevision = async <
  Day extends RevisionedJournalDay,
>(
  load: () => Promise<Day>,
  tracker: ConfirmedRevisionTracker = confirmedRevisions,
): Promise<Day> => {
  const loader = tracker.beginLoad();

  const readCurrent = async (remaining: number): Promise<Day> => {
    const loaded = await load();
    const result = tracker.completeLoad(loader, loaded.entry.date, [
      loaded.entry,
      ...loaded.anniversaryRevisions,
    ]);
    if (result === 'accept') {
      return loaded;
    }
    if (remaining === 1) {
      throw new Error(
        'Fresh journal reads did not include the confirmed save.',
      );
    }
    return readCurrent(remaining - 1);
  };

  try {
    return await readCurrent(maximumLoaderReads);
  } catch (error) {
    tracker.abandonLoad(loader);
    throw error;
  }
};
