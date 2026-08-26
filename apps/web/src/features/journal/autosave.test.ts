/**
 * The autosave rule, driven as plain values.
 *
 * These are the cases a browser produces rarely and a test produces on demand:
 * a reply landing after the writer has typed something newer, a burst of
 * keystrokes during a slow round trip, a failure followed by more typing. Each
 * one decides what the table ends up holding, and none of them is visible by
 * using the app for a minute.
 */

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

/** Replays a run of events, keeping every command each one produced. */
const run = (
  events: ReadonlyArray<AutosaveEvent>,
  from: AutosaveState = openAutosave(blank),
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

const saves = (
  commands: ReadonlyArray<AutosaveCommand>,
): ReadonlyArray<string> =>
  commands
    .filter((command) => command._tag === 'save')
    .map((command) => command.draft.journalMarkdown);

it('opens with nothing to say and nothing to do', () => {
  const state = openAutosave(blank);
  expect(saveStatus(state)).toBe('saved');
  expect(run([{ _tag: 'flush' }], state).commands).toEqual([
    { _tag: 'cancel' },
  ]);
});

it('asks for a quiet period rather than writing on every keystroke', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('An') },
    { _tag: 'edited', draft: wrote('An e') },
    { _tag: 'edited', draft: wrote('An ev') },
  ]);

  expect(saves(commands)).toEqual([]);
  expect(commands).toEqual([
    { _tag: 'schedule' },
    { _tag: 'schedule' },
    { _tag: 'schedule' },
  ]);
  expect(saveStatus(state)).toBe('unsaved');
});

it('writes the newest text once the typing stops', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('An ev') },
    { _tag: 'quiet' },
  ]);

  expect(saves(commands)).toEqual(['An ev']);
  expect(saveStatus(state)).toBe('saving');
});

/*
 * The case the whole module exists for. Twenty keystrokes during one slow
 * round trip must not become twenty writes racing each other: they collapse
 * into the single write that follows the reply, carrying the last of them.
 */
it('collapses everything typed during a save into one more save', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('one') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: wrote('one two') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: wrote('one two three') },
    { _tag: 'flush' },
    { _tag: 'stored' },
  ]);

  expect(saves(commands)).toEqual(['one', 'one two three']);
  expect(state.inFlight?.journalMarkdown).toBe('one two three');
});

it('stops when the reply catches up with the writer', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('done') },
    { _tag: 'quiet' },
    { _tag: 'stored' },
  ]);

  expect(saves(commands)).toEqual(['done']);
  expect(saveStatus(state)).toBe('saved');
  expect(state.stored.journalMarkdown).toBe('done');
});

/*
 * A reply says what the request carried, not what is on screen now. Reading the
 * stored text off the event instead would mark the newer text as already
 * written and drop it.
 */
it('does not count text typed after a save as saved by it', () => {
  const { state } = run([
    { _tag: 'edited', draft: wrote('sent') },
    { _tag: 'quiet' },
    { _tag: 'edited', draft: wrote('sent and more') },
    { _tag: 'stored' },
  ]);

  expect(state.stored.journalMarkdown).toBe('sent');
  expect(state.draft.journalMarkdown).toBe('sent and more');
});

it('treats text undone back to what is stored as nothing to write', () => {
  const { state, commands } = run([
    { _tag: 'edited', draft: wrote('typed') },
    { _tag: 'edited', draft: wrote('') },
    { _tag: 'quiet' },
  ]);

  expect(saves(commands)).toEqual([]);
  expect(saveStatus(state)).toBe('saved');
});

it('writes a changed scripture reference like any other edit', () => {
  const { commands } = run([
    {
      _tag: 'edited',
      draft: { ...blank, scriptureReference: 'Proverbs 12:5-13' },
    },
    { _tag: 'quiet' },
  ]);

  expect(commands.at(-1)).toEqual({
    _tag: 'save',
    draft: { ...blank, scriptureReference: 'Proverbs 12:5-13' },
  });
});
