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
const validationFailure = {
  kind: 'validation',
  field: 'scriptureReference',
  message: 'Check the passage.',
} as const;
const blank: EntryDraft = {
  date: '2026-08-26',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
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

it('clears a failed save when undo returns to the stored draft', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'failed', failure: networkFailure },
    { _tag: 'edited', draft: blank },
  ]);
  expect(commands.at(-1)).toEqual({ _tag: 'cancel' });
  expect(state.failure).toBeUndefined();
  expect(saveStatus(state)).toBe('saved');
});

it('ignores a failed reply after undo returned to the stored draft', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('unlucky') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: blank },
    { _tag: 'failed', failure: networkFailure },
  ]);
  expect(state.failure).toBeUndefined();
  expect(saveStatus(state)).toBe('saved');
});

it('keeps passage validation until the changed passage is locally valid', () => {
  const invalid = { ...blank, scriptureReference: 'Proverbs 12:' };
  const { state } = run([
    { _tag: 'edited', draft: invalid },
    { _tag: 'quiet' },
    { _tag: 'failed', failure: validationFailure },
    {
      _tag: 'edited',
      draft: { ...invalid, scriptureReference: 'still not a passage' },
    },
  ]);
  expect(state.failure).toBe(validationFailure);
  expect(saveStatus(state)).toBe('failed');

  const corrected = run(
    [
      {
        _tag: 'edited',
        draft: { ...invalid, scriptureReference: 'Proverbs 12:5' },
      },
    ],
    state,
  ).state;
  expect(corrected.failure).toBeUndefined();
  expect(saveStatus(corrected)).toBe('unsaved');
});
