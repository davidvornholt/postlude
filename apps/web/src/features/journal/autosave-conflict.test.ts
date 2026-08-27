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
const conflictFailure = {
  kind: 'conflict',
  message: journalWriteConflictMessage,
} as const;

const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const rejectConflict = (): Promise<unknown> =>
  decodeSaveConfirmation(
    new Response(journalWriteConflictMessage, { status: writeConflictStatus }),
  );

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

it('does not overwrite newer server prose after a stale-base conflict', async () => {
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
    save: rejectConflict,
    recovery,
  });

  coordinator.edit({ journalMarkdown: 'Stale tab prose.' });
  coordinator.flush();
  coordinator.edit({ journalMarkdown: '' });
  await settleEffects();

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
  let server = current;
  coordinator.update(current, (next) => {
    sent.push(next);
    server = { draft: next, revision: currentRevision + 1 };
    return Promise.resolve({ revision: server.revision });
  });
  expect(coordinator.snapshot().failure).toEqual({
    kind: 'conflict',
    message: journalWriteConflictMessage,
  });
  expect(coordinator.snapshot().stored).toEqual(current);
  expect(coordinator.snapshot().draft).toEqual({
    ...draft,
    journalMarkdown: 'Stale tab prose.',
  });
  expect(recovered).toEqual(coordinator.snapshot().draft);

  coordinator.flush();
  await settleEffects();

  expect(sent).toHaveLength(0);
  expect(server).toEqual(current);
  expect(coordinator.snapshot().stored).toEqual(current);
  expect(saveStatus(coordinator.snapshot())).toBe('failed');
  expect(recovered?.journalMarkdown).toBe('Stale tab prose.');
});

it('settles a conflict when current server prose matches the recovery', async () => {
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
  const coordinator = createAutosaveCoordinator({
    stored: { draft, revision: draft.baseRevision },
    save: rejectConflict,
    recovery,
  });

  coordinator.edit({ journalMarkdown: 'Shared prose.' });
  coordinator.flush();
  await settleEffects();
  const current = {
    draft: {
      ...draft,
      journalMarkdown: 'Shared prose.',
      baseRevision: currentRevision,
    },
    revision: currentRevision,
  };
  let followUpSaves = 0;
  coordinator.update(current, () => {
    followUpSaves += 1;
    return Promise.resolve({ revision: currentRevision + 1 });
  });
  coordinator.flush();
  await settleEffects();

  expect(coordinator.snapshot()).toEqual(openAutosave(current));
  expect(followUpSaves).toBe(0);
  expect(recovered).toBeUndefined();
});
