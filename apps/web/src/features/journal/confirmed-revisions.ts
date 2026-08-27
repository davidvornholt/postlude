/**
 * Browser-only evidence that a save reached the database.
 *
 * A loader generation is captured before its request starts. Confirmations
 * keep their revision checkpoint until every older loader has finished and a
 * mounted page has observed that revision. The tracker stores dates, numbers,
 * and counters only. If its fixed capacity cannot represent another day, it
 * stops accepting snapshots for the rest of the browser session.
 */

import type { JournalDate } from './journal-day.ts';

type LoaderGeneration = {
  readonly id: number;
  readonly generation: number;
};

type LoaderResult = 'accept' | 'retry' | 'unsafe';

export type ConfirmedRevisionTracker = {
  readonly record: (date: JournalDate, revision: number) => void;
  readonly known: (date: JournalDate) => number | undefined;
  readonly observe: (date: JournalDate, revision: number) => boolean;
  readonly beginLoad: () => LoaderGeneration | undefined;
  readonly completeLoad: (
    loader: LoaderGeneration,
    date: JournalDate,
    revision: number,
  ) => LoaderResult;
  readonly abandonLoad: (loader: LoaderGeneration) => void;
};

type Checkpoint = {
  readonly revision: number;
  readonly generation: number;
  readonly observedRevision: number;
};

const maximumTrackedDays = 32;
const maximumLoaderReads = 3;

export const createConfirmedRevisionTracker = (
  maximum = maximumTrackedDays,
): ConfirmedRevisionTracker => {
  const checkpoints = new Map<JournalDate, Checkpoint>();
  const outstanding = new Map<number, number>();
  let generation = 0;
  let nextLoaderId = 0;
  let unsafe = false;

  const hasOlderLoad = (checkpoint: Checkpoint): boolean => {
    for (const started of outstanding.values()) {
      if (started < checkpoint.generation) {
        return true;
      }
    }
    return false;
  };

  const pruneObserved = (): void => {
    for (const [date, checkpoint] of checkpoints) {
      if (
        checkpoint.observedRevision >= checkpoint.revision &&
        !hasOlderLoad(checkpoint)
      ) {
        checkpoints.delete(date);
      }
    }
  };

  const finish = (loader: LoaderGeneration): void => {
    outstanding.delete(loader.id);
    pruneObserved();
  };

  return {
    record: (date, revision) => {
      if (unsafe) {
        return;
      }
      generation += 1;
      const current = checkpoints.get(date);
      if (current === undefined && checkpoints.size >= maximum) {
        unsafe = true;
        return;
      }
      checkpoints.set(date, {
        revision: Math.max(current?.revision ?? 0, revision),
        generation,
        observedRevision: current?.observedRevision ?? 0,
      });
    },
    known: (date) => checkpoints.get(date)?.revision,
    observe: (date, revision) => {
      if (unsafe) {
        return false;
      }
      const checkpoint = checkpoints.get(date);
      if (checkpoint === undefined) {
        return true;
      }
      if (revision < checkpoint.revision) {
        return false;
      }
      checkpoints.set(date, {
        ...checkpoint,
        observedRevision: Math.max(checkpoint.observedRevision, revision),
      });
      pruneObserved();
      return true;
    },
    beginLoad: () => {
      if (unsafe) {
        return;
      }
      const loader = { id: nextLoaderId, generation };
      nextLoaderId += 1;
      outstanding.set(loader.id, loader.generation);
      return loader;
    },
    completeLoad: (loader, date, revision) => {
      if (!outstanding.has(loader.id) || unsafe) {
        finish(loader);
        return 'unsafe';
      }
      const checkpoint = checkpoints.get(date);
      if (checkpoint !== undefined && revision < checkpoint.revision) {
        return 'retry';
      }
      finish(loader);
      return 'accept';
    },
    abandonLoad: finish,
  };
};

export const confirmedRevisions = createConfirmedRevisionTracker();

type RevisionedJournalDay = {
  readonly entry: {
    readonly date: JournalDate;
    readonly revision: number;
  };
};

const unsafeTrackerMessage =
  'Confirmed journal revisions cannot be tracked safely in this session.';

/** Repeat bounded reads without dropping the generation of the first read. */
export const loadAfterConfirmedRevision = async <
  Day extends RevisionedJournalDay,
>(
  load: () => Promise<Day>,
  tracker: ConfirmedRevisionTracker = confirmedRevisions,
): Promise<Day> => {
  const loader = tracker.beginLoad();
  if (loader === undefined) {
    throw new Error(unsafeTrackerMessage);
  }

  const readCurrent = async (remaining: number): Promise<Day> => {
    const loaded = await load();
    const result = tracker.completeLoad(
      loader,
      loaded.entry.date,
      loaded.entry.revision,
    );
    if (result === 'accept') {
      return loaded;
    }
    if (result === 'unsafe') {
      throw new Error(unsafeTrackerMessage);
    }
    if (remaining === 1) {
      tracker.abandonLoad(loader);
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
