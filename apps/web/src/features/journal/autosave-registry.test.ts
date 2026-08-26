import { expect, it } from 'bun:test';

import { createAutosaveRegistry } from './autosave-registry.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';

const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: '',
};
const stored = { draft, revision: 100 };

const memoryRecovery = (): DraftRecovery => {
  let recovered: EntryDraft | undefined;
  return {
    read: () => recovered,
    retain: (next) => {
      recovered = next;
    },
    clear: () => {
      recovered = undefined;
    },
  };
};

const deferred = () => {
  let resolve: (value: SaveConfirmation) => void = () => undefined;
  const promise = new Promise<SaveConfirmation>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

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

it('flushes quiet edits and waits for their save before a dependent read', async () => {
  const pending = deferred();
  const registry = createAutosaveRegistry(memoryRecovery);
  const coordinator = registry.acquire(stored, () => pending.promise);
  coordinator.edit({ journalMarkdown: 'Include me in the archive.' });
  let finished = false;

  const settling = registry.settle().then(() => {
    finished = true;
  });
  await settleEffects();

  expect(finished).toBe(false);
  expect(coordinator.snapshot().inFlight?.journalMarkdown).toBe(
    'Include me in the archive.',
  );

  pending.resolve({ revision: 101 });
  await settling;
  expect(finished).toBe(true);
});

it('retains an in-flight coordinator across mounts, then evicts it', async () => {
  const pending = deferred();
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
