import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';

export const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
};

export const stored = { draft, revision: 100 };

export const storedFor = (date: string) => ({
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
