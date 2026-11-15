import { expect, it } from 'bun:test';

import {
  type AutosaveCommand,
  type AutosaveEvent,
  type AutosaveState,
  advanceAutosave,
  openAutosave,
  saveStatus,
} from './autosave.ts';
import type { EntryDraft } from './schemas/entry.ts';

const networkFailure = {
  kind: 'network',
  message: 'Could not save. Check your connection.',
} as const;
const blank: EntryDraft = {
  date: '2026-08-26',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 1,
};
const wrote = (text: string): EntryDraft => ({
  ...blank,
  journalMarkdown: text,
});
const confirmed = (draft: EntryDraft) => ({ draft, revision: 1 });
const run = (
  events: ReadonlyArray<AutosaveEvent>,
  from: AutosaveState = openAutosave(confirmed(blank)),
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

it('ignores a failure for a save it is not waiting on', () => {
  const opened = openAutosave(confirmed(blank));
  expect(
    run([{ _tag: 'failed', failure: networkFailure }], opened).state,
  ).toEqual(opened);
});

it('reports a failure and keeps the text it could not write', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'failed', failure: networkFailure },
  ]);
  expect(saveStatus(state)).toBe('failed');
  expect(state.draft.journalMarkdown).toBe('unlucky');
  expect(state.stored.draft.journalMarkdown).toBe('');
});

it('keeps saying failed while the writer types on', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'failed', failure: networkFailure },
    { _tag: 'edited', draft: wrote('unlucky still') },
  ]);
  expect(saveStatus(state)).toBe('failed');
});

it('clears the failure once a later save gets through', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'failed', failure: networkFailure },
    { _tag: 'flush' },
    { _tag: 'stored', revision: 2 },
  ]);
  expect(saveStatus(state)).toBe('saved');
});

it('sends an undo after a failed save instead of calling it saved', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'failed', failure: networkFailure },
    { _tag: 'edited', draft: blank },
    { _tag: 'quiet' },
  ]);
  // The failed write may have been committed, so the server may hold 'unlucky'.
  expect(commands.at(-1)).toEqual({ _tag: 'save', draft: blank });
  expect(state.failure).toBe(networkFailure);
  expect(saveStatus(state)).toBe('saving');
});

it('sends an undo made while the failed save was in flight', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: blank },
    { _tag: 'failed', failure: networkFailure },
  ]);
  expect(commands.at(-1)).toEqual({ _tag: 'save', draft: blank });
  expect(state.inFlight).toEqual(blank);
  expect(state.failure).toBe(networkFailure);
});

it('keeps saying failed when the undo cannot be sent either', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: blank },
    { _tag: 'failed', failure: networkFailure },
    { _tag: 'failed', failure: networkFailure },
  ]);
  expect(saveStatus(state)).toBe('failed');
});

it('calls an undo saved after a refused sign-in, which wrote nothing', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: blank },
    {
      _tag: 'failed',
      failure: { kind: 'authentication', message: 'Sign in again.' },
    },
  ]);
  expect(state.failure).toBeUndefined();
  expect(saveStatus(state)).toBe('saved');
});
