import { expect, it } from 'bun:test';

import { createLeaveGuard } from './leave-guard.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft } from './schemas/entry.ts';

const draftOn = (date: string): EntryDraft => ({
  date,
  journalMarkdown: 'Unsaved words.',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 1,
});

const recordingRecovery = (calls: Array<string>): DraftRecovery => ({
  read: () => undefined,
  retain: (draft) => calls.push(`retain ${draft.date}`),
  clear: (date) => calls.push(`clear ${date}`),
});

const closingIsQuestioned = (target: EventTarget): boolean => {
  const closing = new Event('beforeunload', { cancelable: true });
  target.dispatchEvent(closing);
  return closing.defaultPrevented;
};

it('asks before closing until every unsaved day is confirmed', () => {
  const target = new EventTarget();
  const calls: Array<string> = [];
  const guard = createLeaveGuard(() => target);
  const first = guard(recordingRecovery(calls));
  const second = guard(recordingRecovery(calls));

  expect(closingIsQuestioned(target)).toBe(false);
  first.retain(draftOn('2026-08-25'));
  second.retain(draftOn('2026-08-26'));
  expect(closingIsQuestioned(target)).toBe(true);
  first.clear('2026-08-25');
  expect(closingIsQuestioned(target)).toBe(true);
  second.clear('2026-08-26');
  expect(closingIsQuestioned(target)).toBe(false);
  expect(calls).toEqual([
    'retain 2026-08-25',
    'retain 2026-08-26',
    'clear 2026-08-25',
    'clear 2026-08-26',
  ]);
});

it('adds one listener however often an unsaved day is retained', () => {
  const added: Array<string> = [];
  const target = new EventTarget();
  const guard = createLeaveGuard(() => ({
    addEventListener: (type, listener) => {
      added.push(type);
      target.addEventListener(type, listener);
    },
    removeEventListener: (type, listener) =>
      target.removeEventListener(type, listener),
  }));
  const recovery = guard(recordingRecovery([]));

  recovery.retain(draftOn('2026-08-26'));
  recovery.retain(draftOn('2026-08-26'));
  recovery.clear('2026-08-25');

  expect(added).toEqual(['beforeunload']);
  expect(closingIsQuestioned(target)).toBe(true);
});
