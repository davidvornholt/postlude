import { expect, it } from 'bun:test';

import {
  createTestAutosaveRegistry,
  deferredSave,
  draft,
  memoryRecovery,
  settleEffects,
  stored,
} from './autosave-registry.test-support.ts';
import { createAutosaveRegistry } from './autosave-registry.ts';
import { createConfirmedRevisionTracker } from './confirmed-revisions.ts';

const savedRevision = 101;

it('evicts a clean day after its last subscriber leaves', () => {
  const registry = createTestAutosaveRegistry();
  const save = () => Promise.resolve({ revision: 101 });
  const first = registry.acquire(stored, save);
  const unsubscribe = first.subscribe(() => undefined);

  unsubscribe();

  expect(registry.acquire(stored, save)).not.toBe(first);
});

it('retains a coordinator while its quiet timer carries an edit', () => {
  const registry = createTestAutosaveRegistry();
  const save = () => Promise.resolve({ revision: 101 });
  const first = registry.acquire(stored, save);
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'Waiting quietly.' });
  unsubscribe();

  expect(registry.acquire(stored, save)).toBe(first);

  first.edit({ journalMarkdown: '' });
  expect(registry.acquire(stored, save)).not.toBe(first);
});

it('evicts a confirmed coordinator and retains only its revision', async () => {
  const pending = deferredSave();
  const revisions = createConfirmedRevisionTracker();
  const registry = createAutosaveRegistry(memoryRecovery, revisions);
  const first = registry.acquire(stored, () => pending.promise);
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'In flight.' });
  first.flush();
  unsubscribe();

  expect(registry.acquire(stored, () => pending.promise)).toBe(first);

  pending.resolve({ revision: savedRevision });
  await settleEffects();
  expect(() =>
    registry.acquire(stored, () => Promise.resolve({ revision: 102 })),
  ).toThrow('stale journal snapshot');
  expect(revisions.known(draft.date)).toBe(savedRevision);

  const loaded = {
    draft: {
      ...draft,
      journalMarkdown: 'In flight.',
      baseRevision: savedRevision,
    },
    revision: savedRevision,
  };
  const remounted = registry.acquire(loaded, () =>
    Promise.resolve({ revision: 102 }),
  );
  expect(remounted).not.toBe(first);
  expect(revisions.known(draft.date)).toBeUndefined();
  expect(remounted.snapshot().stored).toEqual(loaded);
});

it('rejects a cached stale acquisition after a confirmed checkpoint is released', () => {
  const revisions = createConfirmedRevisionTracker(2);
  const registry = createAutosaveRegistry(memoryRecovery, revisions);
  const current = {
    draft: { ...draft, journalMarkdown: 'Current.', baseRevision: 101 },
    revision: 101,
  };
  revisions.record(draft.date, current.revision);
  const mounted = registry.acquire(current, () =>
    Promise.resolve({ revision: 102 }),
  );
  const unsubscribe = mounted.subscribe(() => undefined);
  unsubscribe();

  expect(revisions.known(draft.date)).toBeUndefined();
  expect(() =>
    registry.acquire(stored, () => Promise.resolve({ revision: 102 })),
  ).toThrow('stale journal snapshot');

  const remounted = registry.acquire(current, () =>
    Promise.resolve({ revision: 102 }),
  );
  expect(remounted.snapshot().stored).toEqual(current);
});

it('retains a failed recoverable draft until it is undone', async () => {
  const recovery = memoryRecovery();
  const registry = createTestAutosaveRegistry(() => recovery);
  const save = () => Promise.reject(new TypeError('offline'));
  const first = registry.acquire(stored, save);
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'Recover me.' });
  first.flush();
  unsubscribe();
  await settleEffects();

  expect(registry.acquire(stored, save)).toBe(first);

  first.edit({ journalMarkdown: '' });
  expect(registry.acquire(stored, save)).not.toBe(first);
});
