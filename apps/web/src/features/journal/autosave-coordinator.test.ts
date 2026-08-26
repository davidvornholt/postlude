import { describe, expect, it } from 'bun:test';
import {
  authenticationSaveMessage,
  autosaveFailureOf,
  createAutosaveCoordinator,
} from './autosave-coordinator.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft } from './schemas/entry.ts';

const stored: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
};

const memoryRecovery = (): DraftRecovery & {
  readonly value: () => EntryDraft | undefined;
} => {
  let draft: EntryDraft | undefined;
  return {
    read: () => draft,
    retain: (next) => {
      draft = next;
    },
    clear: () => {
      draft = undefined;
    },
    value: () => draft,
  };
};

const deferred = () => {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('autosave coordinator', () => {
  it('serializes saves across an unmount and remount', async () => {
    const first = deferred();
    const second = deferred();
    const sent: Array<EntryDraft> = [];
    const save = (draft: EntryDraft): Promise<void> => {
      sent.push(draft);
      return sent.length === 1 ? first.promise : second.promise;
    };
    const coordinator = createAutosaveCoordinator({
      stored,
      save,
      recovery: memoryRecovery(),
    });

    const unsubscribe = coordinator.subscribe(() => undefined);
    coordinator.edit({ journalMarkdown: 'first' });
    coordinator.flush();
    unsubscribe();
    coordinator.leave();
    coordinator.subscribe(() => undefined);
    coordinator.edit({ journalMarkdown: 'second' });
    coordinator.flush();

    expect(sent.map((draft) => draft.journalMarkdown)).toEqual(['first']);
    first.resolve();
    await settleEffects();
    expect(sent.map((draft) => draft.journalMarkdown)).toEqual([
      'first',
      'second',
    ]);
    second.resolve();
  });

  it('restores a retained draft and clears it only after confirmation', async () => {
    const recovery = memoryRecovery();
    recovery.retain({ ...stored, journalMarkdown: 'Recovered words.' });
    const saved = deferred();
    const coordinator = createAutosaveCoordinator({
      stored,
      save: () => saved.promise,
      recovery,
    });

    expect(coordinator.snapshot().draft.journalMarkdown).toBe(
      'Recovered words.',
    );
    coordinator.flush();
    expect(recovery.value()?.journalMarkdown).toBe('Recovered words.');
    saved.resolve();
    await settleEffects();
    expect(recovery.value()).toBeUndefined();
  });

  it('flushes when the document changes visibility and retries on return', async () => {
    const recovery = memoryRecovery();
    const first = deferred();
    const second = deferred();
    let attempts = 0;
    const coordinator = createAutosaveCoordinator({
      stored,
      save: () => {
        attempts += 1;
        return attempts === 1 ? first.promise : second.promise;
      },
      recovery,
    });

    coordinator.edit({ journalMarkdown: 'Hidden thought.' });
    coordinator.visibilityChanged();
    expect(attempts).toBe(1);
    expect(recovery.value()?.journalMarkdown).toBe('Hidden thought.');
    first.reject(new TypeError('offline'));
    await settleEffects();
    coordinator.visibilityChanged();
    expect(attempts).toBe(2);
    second.resolve();
  });
});

describe('autosave failure boundary', () => {
  it('recognizes authentication and the one safe validation message', () => {
    expect(autosaveFailureOf(new Response('', { status: 401 }))).toEqual({
      kind: 'authentication',
      message: authenticationSaveMessage,
    });
    expect(
      autosaveFailureOf({
        message:
          'FiberFailure: Check the scripture reference and use a form such as Proverbs 12:5-13.',
      }),
    ).toEqual({
      kind: 'validation',
      field: 'scriptureReference',
      message:
        'Check the scripture reference and use a form such as Proverbs 12:5-13.',
    });
  });

  it('does not carry an unknown server message to the page', () => {
    const failure = autosaveFailureOf(
      new Error('password leaked in a database error'),
    );

    expect(failure.kind).toBe('network');
    expect(failure.message).not.toContain('password');
    expect(failure.message).toContain('check your connection');
  });
});
