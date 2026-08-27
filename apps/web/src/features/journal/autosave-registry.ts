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
import {
  type ConfirmedRevisionTracker,
  confirmedRevisions,
} from './confirmed-revisions.ts';
import type { DraftRecovery } from './recoverable-draft.ts';

export type AutosaveRegistry = {
  readonly acquire: (
    stored: ConfirmedDraft,
    save: SaveDraft,
  ) => AutosaveCoordinator;
};

export const createAutosaveRegistry = (
  recovery: () => DraftRecovery,
  revisions: ConfirmedRevisionTracker = confirmedRevisions,
): AutosaveRegistry => {
  const coordinators = new Map<string, AutosaveCoordinator>();

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
        onConfirmed: (saved) => revisions.record(date, saved.revision),
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
