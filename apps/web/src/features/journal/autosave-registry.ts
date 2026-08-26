/**
 * The set of journal-day coordinators still carrying browser work.
 *
 * A clean coordinator disappears with its last subscriber. One with a timer,
 * request, failed draft, or recovery copy remains so the next mount resumes
 * the same ordered queue instead of creating a competing one.
 */

import type { ConfirmedDraft } from './autosave.ts';
import {
  type AutosaveCoordinator,
  createAutosaveCoordinator,
  type SaveDraft,
} from './autosave-coordinator.ts';
import type { DraftRecovery } from './recoverable-draft.ts';

export type AutosaveRegistry = {
  readonly acquire: (
    stored: ConfirmedDraft,
    save: SaveDraft,
  ) => AutosaveCoordinator;
};

export const createAutosaveRegistry = (
  recovery: () => DraftRecovery,
): AutosaveRegistry => {
  const coordinators = new Map<string, AutosaveCoordinator>();
  const confirmed = new Map<string, ConfirmedDraft>();

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
  };
};
