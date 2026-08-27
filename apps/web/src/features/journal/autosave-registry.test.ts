import { expect, it } from 'bun:test';

import {
  deferredSave,
  draft,
  memoryRecovery,
  settleEffects,
  stored,
} from './autosave-registry.test-support.ts';
import { createAutosaveRegistry } from './autosave-registry.ts';

it('evicts a clean day after its last subscriber leaves', () => {
  const registry = createAutosaveRegistry(memoryRecovery);
  const save = () => Promise.resolve({ revision: 101 });
  const first = registry.acquire(stored, save);
  const unsubscribe = first.subscribe(() => undefined);

  unsubscribe();

  expect(registry.acquire(stored, save)).not.toBe(first);
});

it('retains a coordinator while its quiet timer carries an edit', () => {
  const registry = createAutosaveRegistry(memoryRecovery);
  const save = () => Promise.resolve({ revision: 101 });
  const first = registry.acquire(stored, save);
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'Waiting quietly.' });
  unsubscribe();

  expect(registry.acquire(stored, save)).toBe(first);

  first.edit({ journalMarkdown: '' });
  expect(registry.acquire(stored, save)).not.toBe(first);
});

it('retains an in-flight coordinator across mounts, then evicts it', async () => {
  const pending = deferredSave();
  const registry = createAutosaveRegistry(memoryRecovery);
  const first = registry.acquire(stored, () => pending.promise);
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'In flight.' });
  first.flush();
  unsubscribe();

  expect(registry.acquire(stored, () => pending.promise)).toBe(first);

  pending.resolve({ revision: 101 });
  await settleEffects();
  const remounted = registry.acquire(stored, () =>
    Promise.resolve({ revision: 102 }),
  );
  expect(remounted).not.toBe(first);
  expect(remounted.snapshot()).toMatchObject({
    draft: { ...draft, journalMarkdown: 'In flight.' },
    stored: {
      draft: { ...draft, journalMarkdown: 'In flight.' },
      revision: 101,
    },
  });

  const genuinelyNewer = {
    draft: { ...draft, journalMarkdown: 'Loaded after the save.' },
    revision: 102,
  };
  registry.acquire(genuinelyNewer, () => Promise.resolve({ revision: 103 }));
  expect(remounted.snapshot()).toMatchObject({
    draft: genuinelyNewer.draft,
    stored: genuinelyNewer,
  });
});

it('retains a failed recoverable draft until it is undone', async () => {
  const recovery = memoryRecovery();
  const registry = createAutosaveRegistry(() => recovery);
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
