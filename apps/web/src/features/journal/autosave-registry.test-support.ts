import {
  type AutosaveRegistry,
  createAutosaveRegistry,
} from './autosave-registry.ts';
import { createConfirmedRevisionTracker } from './confirmed-revisions.ts';
import type { JournalDate } from './journal-day.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';

export const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 100,
};

export const stored = { draft, revision: 100 };

export const storedFor = (date: JournalDate) => ({
  draft: { ...draft, date },
  revision: stored.revision,
});

export const memoryRecovery = (): DraftRecovery => {
  let recovered: EntryDraft | undefined;
  return {
    read: () => recovered,
    retain: (next) => {
      recovered = next;
    },
    clear: () => {
      recovered = undefined;
    },
  };
};

export const createTestAutosaveRegistry = (
  recovery: () => DraftRecovery = memoryRecovery,
): AutosaveRegistry =>
  createAutosaveRegistry(recovery, createConfirmedRevisionTracker());

export const deferredSave = () => {
  let resolve: (value: SaveConfirmation) => void = () => undefined;
  const promise = new Promise<SaveConfirmation>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

export const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};
