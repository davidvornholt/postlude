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
import type { JournalDate } from './journal-day.ts';
import type { DraftRecovery } from './recoverable-draft.ts';

export type AutosaveRegistry = {
  readonly acquire: (
    stored: ConfirmedDraft,
    save: SaveDraft,
  ) => AutosaveCoordinator;
  /** Starts every queued save and rejects if any draft remains unconfirmed. */
  readonly settle: () => Promise<void>;
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
): AutosaveRegistry => {
  const coordinators = new Map<string, AutosaveCoordinator>();
  const confirmed = new Map<string, ConfirmedDraft>();

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

  return {
    acquire: (stored, save) => {
      const {
        draft: { date },
      } = stored;
      const checkpoint = confirmed.get(date);
      const loaderIsStale =
        checkpoint !== undefined && checkpoint.revision > stored.revision;
      const current =
        loaderIsStale && checkpoint !== undefined ? checkpoint : stored;
      if (!loaderIsStale) {
        confirmed.delete(date);
      }
      const existing = coordinators.get(date);
      if (existing !== undefined) {
        existing.update(current, save);
        return existing;
      }

      let created: AutosaveCoordinator;
      created = createAutosaveCoordinator({
        stored: current,
        save,
        recovery: recovery(),
        onConfirmed: (saved) => confirmed.set(date, saved),
        onIdle: () => {
          if (coordinators.get(date) === created) {
            coordinators.delete(date);
          }
        },
      });
      coordinators.set(date, created);
      return created;
    },
    settle,
  };
};
