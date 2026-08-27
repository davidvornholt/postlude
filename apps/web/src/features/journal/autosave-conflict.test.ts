import { expect, it } from 'bun:test';

import { createAutosaveCoordinator } from './autosave-coordinator.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft } from './schemas/entry.ts';

const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 100,
};

it('keeps stale-tab prose recoverable when its base revision conflicts', async () => {
  let recovered: EntryDraft | undefined;
  const recovery: DraftRecovery = {
    read: () => recovered,
    retain: (next) => {
      recovered = next;
    },
    clear: () => {
      recovered = undefined;
    },
  };
  const stored = { draft, revision: draft.baseRevision };
  const coordinator = createAutosaveCoordinator({
    stored,
    save: () => Promise.reject(new Error(journalWriteConflictMessage)),
    recovery,
  });

  coordinator.edit({ journalMarkdown: 'Stale tab prose.' });
  coordinator.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(coordinator.snapshot().failure).toEqual({
    kind: 'conflict',
    message: journalWriteConflictMessage,
  });
  expect(coordinator.snapshot().stored).toEqual(stored);
  expect(coordinator.snapshot().draft.journalMarkdown).toBe('Stale tab prose.');
  expect(recovered?.journalMarkdown).toBe('Stale tab prose.');
});
