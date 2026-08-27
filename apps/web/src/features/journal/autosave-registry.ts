/**
 * The set of journal-day coordinators still carrying browser work.
 *
 * A clean coordinator disappears with its last subscriber. One with a timer,
 * request, failed draft, or recovery copy remains so the next mount resumes
 * the same ordered queue instead of creating a competing one.
 */

import { Data } from 'effect';
import {
  type AutosaveFailure,
  type ConfirmedDraft,
  sameDraft,
} from './autosave.ts';
import {
  type AutosaveCoordinator,
  createAutosaveCoordinator,
  type SaveDraft,
} from './autosave-coordinator.ts';
import {
  type ConfirmedRevisionTracker,
  confirmedRevisions,
} from './confirmed-revisions.ts';
import type { JournalDate } from './journal-day.ts';
import type { DraftRecovery } from './recoverable-draft.ts';

export type AutosaveRegistry = {
  readonly acquire: (
    stored: ConfirmedDraft,
    save: SaveDraft,
  ) => AutosaveCoordinator;
  /** Starts every queued save and rejects if any draft remains unconfirmed. */
  readonly settle: () => Promise<void>;
  /** Repeats a read when a confirmed save lands before that read finishes. */
  readonly readAfterSettled: <A>(read: () => Promise<A>) => Promise<A>;
};

export class AutosaveSettlementError extends Data.TaggedError(
  'AutosaveSettlementError',
)<{
  readonly date: JournalDate;
  readonly failure: AutosaveFailure | undefined;
  readonly message: string;
}> {}

const settleCoordinator = (coordinator: AutosaveCoordinator): Promise<void> =>
  new Promise((resolve, reject) => {
    let unsubscribe = (): void => undefined;
    const resolveWhenSettled = (): void => {
      const state = coordinator.snapshot();
      if (state.inFlight !== undefined) {
        return;
      }
      unsubscribe();
      if (sameDraft(state.draft, state.stored.draft)) {
        resolve();
        return;
      }
      reject(
        new AutosaveSettlementError({
          date: state.draft.date,
          failure: state.failure,
          message: state.failure?.message ?? 'The journal draft is not stored.',
        }),
      );
    };
    unsubscribe = coordinator.subscribe(resolveWhenSettled);
    coordinator.flush();
    resolveWhenSettled();
  });

export const createAutosaveRegistry = (
  recovery: () => DraftRecovery,
  revisions: ConfirmedRevisionTracker = confirmedRevisions,
): AutosaveRegistry => {
  const coordinators = new Map<string, AutosaveCoordinator>();
  let confirmedSaveGeneration = 0;

  const settle = async (): Promise<void> => {
    await Promise.all(Array.from(coordinators.values(), settleCoordinator));
    const allSettled = Array.from(coordinators.values()).every(
      (coordinator) => {
        const state = coordinator.snapshot();
        return (
          state.inFlight === undefined &&
          sameDraft(state.draft, state.stored.draft)
        );
      },
    );
    if (!allSettled) {
      return settle();
    }
  };

  const readAfterSettled = async <A>(read: () => Promise<A>): Promise<A> => {
    await settle();
    const generationBeforeRead = confirmedSaveGeneration;
    const result = await read();
    await settle();
    if (confirmedSaveGeneration === generationBeforeRead) {
      return result;
    }
    return readAfterSettled(read);
  };

  return {
    acquire: (stored, save) => {
      const {
        draft: { date },
      } = stored;
      if (!revisions.observe(date, stored.revision)) {
        throw new Error('A stale journal snapshot reached autosave.');
      }
      const existing = coordinators.get(date);
      if (existing !== undefined) {
        existing.update(stored, save);
        return existing;
      }
      let created: AutosaveCoordinator;
      created = createAutosaveCoordinator({
        stored,
        save,
        recovery: recovery(),
        onConfirmed: (saved) => {
          confirmedSaveGeneration += 1;
          revisions.record(date, saved.revision);
        },
        onIdle: () => {
          if (coordinators.get(date) === created) {
            coordinators.delete(date);
          }
        },
      });
      coordinators.set(date, created);
      return created;
    },
    readAfterSettled,
    settle,
  };
};
