import { expect, it } from 'bun:test';

import {
  type AutosaveCommand,
  type AutosaveEvent,
  type AutosaveState,
  advanceAutosave,
  openAutosave,
  saveStatus,
} from './autosave.ts';
import { createAutosaveCoordinator } from './autosave-coordinator.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import { decodeSaveConfirmation } from './save-confirmation.ts';
import type { EntryDraft } from './schemas/entry.ts';

const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 100,
};
const writeConflictStatus = 409;
const currentRevision = 101;
const savedRevision = 102;
const conflictFailure = {
  kind: 'conflict',
  message: journalWriteConflictMessage,
} as const;

const run = (
  events: ReadonlyArray<AutosaveEvent>,
  from: AutosaveState = openAutosave({
    draft,
    revision: draft.baseRevision,
  }),
): { state: AutosaveState; commands: ReadonlyArray<AutosaveCommand> } => {
  let state = from;
  const commands: Array<AutosaveCommand> = [];
  for (const event of events) {
    const [next, issued] = advanceAutosave(state, event);
    state = next;
    commands.push(...issued);
  }
  return { state, commands };
};

it('keeps a conflict and its failed prose after an in-flight undo', () => {
  const changed = { ...draft, journalMarkdown: 'Do not lose this.' };
  const { state, commands } = run([
    { _tag: 'edited', draft: changed },
    { _tag: 'quiet' },
    { _tag: 'edited', draft },
    { _tag: 'failed', failure: conflictFailure },
  ]);

  expect(commands.at(-1)).toEqual({ _tag: 'cancel' });
  expect(state.failure).toBe(conflictFailure);
  expect(state.draft).toEqual(changed);
  expect(state.stored.draft).toEqual(draft);
  expect(saveStatus(state)).toBe('failed');

  const undoneAgain = run([{ _tag: 'edited', draft }], state).state;
  expect(undoneAgain.failure).toBe(conflictFailure);
  expect(saveStatus(undoneAgain)).toBe('failed');
});

it('does not resubmit newer prose against the same conflicted revision', () => {
  const first = { ...draft, journalMarkdown: 'Sent first.' };
  const later = { ...draft, journalMarkdown: 'Typed later.' };
  const { state, commands } = run([
    { _tag: 'edited', draft: first },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: later },
    { _tag: 'failed', failure: conflictFailure },
    { _tag: 'flush' },
  ]);

  expect(commands.filter((command) => command._tag === 'save')).toHaveLength(1);
  expect(state.draft).toEqual(later);
  expect(saveStatus(state)).toBe('failed');
});

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
    save: () =>
      decodeSaveConfirmation(
        new Response(journalWriteConflictMessage, {
          status: writeConflictStatus,
        }),
      ),
    recovery,
  });

  coordinator.edit({ journalMarkdown: 'Stale tab prose.' });
  coordinator.flush();
  coordinator.edit({ journalMarkdown: '' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(coordinator.snapshot().failure).toEqual({
    kind: 'conflict',
    message: journalWriteConflictMessage,
  });
  expect(coordinator.snapshot().stored).toEqual(stored);
  expect(coordinator.snapshot().draft.journalMarkdown).toBe('Stale tab prose.');
  expect(recovered?.journalMarkdown).toBe('Stale tab prose.');

  const current = {
    draft: {
      ...draft,
      journalMarkdown: 'Other tab prose.',
      baseRevision: currentRevision,
    },
    revision: currentRevision,
  };
  const sent: Array<EntryDraft> = [];
  coordinator.update(current, (next) => {
    sent.push(next);
    return Promise.resolve({ revision: savedRevision });
  });
  expect(coordinator.snapshot().failure).toBeUndefined();
  expect(coordinator.snapshot().stored).toEqual(current);
  expect(coordinator.snapshot().draft).toMatchObject({
    journalMarkdown: 'Stale tab prose.',
    baseRevision: currentRevision,
  });

  coordinator.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(sent).toHaveLength(1);
  expect(sent[0]?.baseRevision).toBe(currentRevision);
  expect(coordinator.snapshot().stored.revision).toBe(savedRevision);
  expect(saveStatus(coordinator.snapshot())).toBe('saved');
  expect(recovered).toBeUndefined();
});
