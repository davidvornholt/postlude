import { isoMonthStart } from './anniversary.ts';
import type { JournalDate } from './journal-day.ts';

type LoaderGeneration = {
  readonly id: number;
  readonly generation: number;
};

type LoaderResult = 'accept' | 'retry';
type RevisionEvidence = {
  readonly date: JournalDate;
  readonly revision: number;
};

export type ConfirmedRevisionTracker = {
  readonly record: (date: JournalDate, revision: number) => void;
  readonly known: (date: JournalDate) => number | undefined;
  readonly observe: (date: JournalDate, revision: number) => boolean;
  readonly beginLoad: () => LoaderGeneration;
  readonly completeLoad: (
    loader: LoaderGeneration,
    loadedDate: JournalDate,
    revisions: ReadonlyArray<RevisionEvidence>,
  ) => LoaderResult;
  readonly abandonLoad: (loader: LoaderGeneration) => void;
};

type Checkpoint = {
  readonly revision: number;
  readonly generation: number;
  readonly observedRevision: number;
};

const hasMissingNewAnniversary = (
  checkpoints: ReadonlyMap<JournalDate, Checkpoint>,
  started: number,
  loadedDate: JournalDate,
  revisions: ReadonlyArray<RevisionEvidence>,
): boolean => {
  const returnedDates = new Set(revisions.map(({ date }) => date));
  for (const [date, checkpoint] of checkpoints) {
    if (
      started < checkpoint.generation &&
      date < loadedDate &&
      date.slice(isoMonthStart) === loadedDate.slice(isoMonthStart) &&
      !returnedDates.has(date)
    ) {
      return true;
    }
  }
  return false;
};

const hasStaleRevision = (
  checkpoints: ReadonlyMap<JournalDate, Checkpoint>,
  revisions: ReadonlyArray<RevisionEvidence>,
): boolean =>
  revisions.some(({ date, revision }) => {
    const checkpoint = checkpoints.get(date);
    return checkpoint !== undefined && revision < checkpoint.revision;
  });

const maximumTrackedDays = 32;
export const createConfirmedRevisionTracker = (
  maximum = maximumTrackedDays,
): ConfirmedRevisionTracker => {
  // Checkpoints survive until a current mount and every older loader clear them.
  const checkpoints = new Map<JournalDate, Checkpoint>();
  // Bounded admissions prove a cached mount followed an accepted load.
  const admissions = new Map<JournalDate, number>();
  const outstanding = new Map<number, number>();
  const capacity = Math.max(1, maximum);
  let generation = 0;
  let nextLoaderId = 0;
  // An evicted checkpoint still makes every older loader reacquire its data.
  let freshnessFloor = 0;
  let guarded = false;

  const admit = (date: JournalDate, revision: number): void => {
    if (!guarded) {
      return;
    }
    admissions.delete(date);
    admissions.set(date, revision);
    while (admissions.size > capacity) {
      const oldest = admissions.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      admissions.delete(oldest);
    }
  };

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
      guarded = true;
      generation += 1;
      admissions.delete(date);
      const current = checkpoints.get(date);
      if (current === undefined && checkpoints.size >= capacity) {
        const oldestDate = checkpoints.keys().next().value;
        if (oldestDate !== undefined) {
          const evicted = checkpoints.get(oldestDate);
          checkpoints.delete(oldestDate);
          freshnessFloor = Math.max(
            freshnessFloor,
            evicted?.generation ?? generation,
          );
        }
      }
      checkpoints.set(date, {
        revision: Math.max(current?.revision ?? 0, revision),
        generation,
        observedRevision: current?.observedRevision ?? 0,
      });
    },
    known: (date) => checkpoints.get(date)?.revision,
    observe: (date, revision) => {
      const checkpoint = checkpoints.get(date);
      if (checkpoint === undefined) {
        const admitted = admissions.get(date);
        return !guarded || (admitted !== undefined && revision >= admitted);
      }
      if (revision < checkpoint.revision) {
        return false;
      }
      admit(date, revision);
      checkpoints.set(date, {
        ...checkpoint,
        observedRevision: Math.max(checkpoint.observedRevision, revision),
      });
      pruneObserved();
      return true;
    },
    beginLoad: () => {
      const loader = { id: nextLoaderId, generation };
      nextLoaderId += 1;
      outstanding.set(loader.id, loader.generation);
      return loader;
    },
    completeLoad: (loader, loadedDate, revisions) => {
      const started = outstanding.get(loader.id);
      if (started === undefined) {
        return 'retry';
      }
      if (started < freshnessFloor) {
        outstanding.set(loader.id, generation);
        return 'retry';
      }
      if (
        hasMissingNewAnniversary(checkpoints, started, loadedDate, revisions)
      ) {
        outstanding.set(loader.id, generation);
        return 'retry';
      }
      if (hasStaleRevision(checkpoints, revisions)) {
        outstanding.set(loader.id, generation);
        return 'retry';
      }
      for (const { date, revision } of revisions) {
        admit(date, revision);
      }
      finish(loader);
      return 'accept';
    },
    abandonLoad: finish,
  };
};

export const confirmedRevisions = createConfirmedRevisionTracker();
