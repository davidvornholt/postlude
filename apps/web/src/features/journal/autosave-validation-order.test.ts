import { expect, it } from 'bun:test';

import { createAutosaveCoordinator } from './autosave-coordinator.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';

const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
};

const memoryDraftRecovery = (): DraftRecovery => ({
  read: () => undefined,
  retain: () => undefined,
  clear: () => undefined,
});

const deferred = () => {
  let resolve: (value: SaveConfirmation) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<SaveConfirmation>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
};

const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

it('sends a valid correction after stale passage validation fails', async () => {
  const invalid = deferred();
  const corrected = deferred();
  const sent: Array<EntryDraft> = [];
  const coordinator = createAutosaveCoordinator({
    stored: { draft, revision: 1 },
    save: (next) => {
      sent.push(next);
      return sent.length === 1 ? invalid.promise : corrected.promise;
    },
    recovery: memoryDraftRecovery(),
  });

  coordinator.edit({ scriptureReference: 'Proverbs 12:' });
  coordinator.flush();
  coordinator.edit({ scriptureReference: 'Proverbs 12:5' });
  invalid.reject(
    new Error(
      'Check the scripture reference and use a form such as Proverbs 12:5-13.',
    ),
  );
  await settleEffects();

  expect(sent.map((entry) => entry.scriptureReference)).toEqual([
    'Proverbs 12:',
    'Proverbs 12:5',
  ]);
  expect(coordinator.snapshot().failure).toBeUndefined();
  corrected.resolve({ revision: 2 });
  await settleEffects();
  expect(coordinator.snapshot().stored.draft.scriptureReference).toBe(
    'Proverbs 12:5',
  );
});
