import { describe, expect, it } from 'bun:test';
import { createAutosaveCoordinator } from './autosave-coordinator.ts';
import { authenticationSaveMessage } from './autosave-error.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';

const baselineDraft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 100,
};
const storedRevision = 100;
const firstSavedRevision = 101;
const savedRevision = 200;
const stored = { draft: baselineDraft, revision: storedRevision };

const memoryRecovery = (): DraftRecovery & {
  readonly value: () => EntryDraft | undefined;
} => {
  let recovered: EntryDraft | undefined;
  return {
    read: () => recovered,
    retain: (next) => {
      recovered = next;
    },
    clear: () => {
      recovered = undefined;
    },
    value: () => recovered,
  };
};

const deferred = () => {
  let resolve: (value: SaveConfirmation) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<SaveConfirmation>((yes, no) => {
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
    const save = (next: EntryDraft): Promise<SaveConfirmation> => {
      sent.push(next);
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

    expect(sent.map((entry) => entry.journalMarkdown)).toEqual(['first']);
    first.resolve({ revision: 101 });
    await settleEffects();
    expect(sent.map((entry) => entry.journalMarkdown)).toEqual([
      'first',
      'second',
    ]);
    expect(sent.map((entry) => entry.baseRevision)).toEqual([
      storedRevision,
      firstSavedRevision,
    ]);
    second.resolve({ revision: 102 });
  });

  it('restores a retained draft and clears it only after confirmation', async () => {
    const recovery = memoryRecovery();
    recovery.retain({
      ...baselineDraft,
      journalMarkdown: 'Recovered words.',
    });
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
    saved.resolve({ revision: 101 });
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
    second.resolve({ revision: 101 });
  });
});

describe('autosave server revision boundary', () => {
  it('treats a resolved unauthorized Response as a failed save', async () => {
    const recovery = memoryRecovery();
    const coordinator = createAutosaveCoordinator({
      stored,
      save: () => Promise.resolve(new Response('', { status: 401 })),
      recovery,
    });

    coordinator.edit({ journalMarkdown: 'Do not lose this.' });
    coordinator.flush();
    await settleEffects();

    expect(coordinator.snapshot().failure).toEqual({
      kind: 'authentication',
      message: authenticationSaveMessage,
    });
    expect(coordinator.snapshot().stored).toEqual(stored);
    expect(recovery.value()?.journalMarkdown).toBe('Do not lose this.');
  });

  it('rejects stale loader snapshots and accepts a newer server revision', async () => {
    const coordinator = createAutosaveCoordinator({
      stored,
      save: () => Promise.resolve({ revision: savedRevision }),
      recovery: memoryRecovery(),
    });
    coordinator.edit({ journalMarkdown: 'Confirmed locally.' });
    coordinator.flush();
    await settleEffects();

    coordinator.update(stored, () => Promise.resolve({ revision: 201 }));
    expect(coordinator.snapshot().draft.journalMarkdown).toBe(
      'Confirmed locally.',
    );
    expect(coordinator.snapshot().stored.revision).toBe(savedRevision);

    const newer = {
      draft: { ...baselineDraft, journalMarkdown: 'Newer server words.' },
      revision: 300,
    };
    coordinator.update(newer, () => Promise.resolve({ revision: 301 }));
    expect(coordinator.snapshot()).toMatchObject({
      draft: newer.draft,
      stored: newer,
    });
  });
});
