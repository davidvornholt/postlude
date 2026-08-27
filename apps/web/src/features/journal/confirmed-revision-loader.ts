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

type RevisionEvidenceOf<Loaded> = (
  loaded: Loaded,
) => RevisionedJournalDay | undefined;

const maximumLoaderReads = 3;

const loadWithConfirmedRevision = async <Loaded>(
  load: () => Promise<Loaded>,
  revisionEvidenceOf: RevisionEvidenceOf<Loaded>,
  tracker: ConfirmedRevisionTracker,
): Promise<Loaded> => {
  const loader = tracker.beginLoad();

  const readCurrent = async (remaining: number): Promise<Loaded> => {
    const loaded = await load();
    const evidence = revisionEvidenceOf(loaded);
    if (evidence === undefined) {
      tracker.abandonLoad(loader);
      return loaded;
    }
    const result = tracker.completeLoad(loader, evidence.entry.date, [
      evidence.entry,
      ...evidence.anniversaryRevisions,
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

export const loadAfterConfirmedRevision = <Day extends RevisionedJournalDay>(
  load: () => Promise<Day>,
  tracker: ConfirmedRevisionTracker = confirmedRevisions,
): Promise<Day> => loadWithConfirmedRevision(load, (loaded) => loaded, tracker);

export const loadClassifiedAfterConfirmedRevision = <Loaded>(
  load: () => Promise<Loaded>,
  revisionEvidenceOf: RevisionEvidenceOf<Loaded>,
  tracker: ConfirmedRevisionTracker = confirmedRevisions,
): Promise<Loaded> =>
  loadWithConfirmedRevision(load, revisionEvidenceOf, tracker);
