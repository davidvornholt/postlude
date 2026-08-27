import { expect, it } from 'bun:test';

import {
  createTestAutosaveRegistry,
  deferredSave,
  draft,
  memoryRecovery,
  settleEffects,
  stored,
  storedFor,
} from './autosave-registry.test-support.ts';
import { journalWriteMessage } from './errors/journal-errors.ts';

const deferredRead = <A>() => {
  let resolve: (value: A) => void = () => undefined;
  const promise = new Promise<A>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it('flushes quiet edits and waits for their save before a dependent read', async () => {
  const pending = deferredSave();
  const registry = createTestAutosaveRegistry();
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

it('keeps watching a clean day while another day is still saving', async () => {
  const firstSave = deferredSave();
  const secondSave = deferredSave();
  const otherSave = deferredSave();
  const registry = createTestAutosaveRegistry();
  let firstSaveCount = 0;
  const first = registry.acquire(storedFor('2026-08-26'), () => {
    firstSaveCount += 1;
    return firstSaveCount === 1 ? firstSave.promise : secondSave.promise;
  });
  const other = registry.acquire(
    storedFor('2026-08-27'),
    () => otherSave.promise,
  );
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'First version.' });
  other.edit({ journalMarkdown: 'Another day.' });
  let finished = false;

  const settling = registry.settle().then(() => {
    finished = true;
  });
  firstSave.resolve({ revision: 101 });
  await settleEffects();
  first.edit({ journalMarkdown: 'Second version.' });
  otherSave.resolve({ revision: 101 });
  await settleEffects();

  expect(finished).toBe(false);
  expect(first.snapshot().inFlight?.journalMarkdown).toBe('Second version.');

  secondSave.resolve({ revision: 102 });
  await settling;
  unsubscribe();
  expect(finished).toBe(true);
  expect(first.snapshot().stored.draft.journalMarkdown).toBe('Second version.');
});

it('rejects settlement when the forced save fails and retains the draft', async () => {
  const recovery = memoryRecovery();
  const registry = createTestAutosaveRegistry(() => recovery);
  const coordinator = registry.acquire(stored, () =>
    Promise.reject(new TypeError('offline')),
  );
  coordinator.edit({ journalMarkdown: 'Keep me on the writing page.' });

  await expect(registry.settle()).rejects.toThrow(journalWriteMessage);
  expect(coordinator.snapshot()).toMatchObject({
    draft: { ...draft, journalMarkdown: 'Keep me on the writing page.' },
    failure: { kind: 'network', message: journalWriteMessage },
    inFlight: undefined,
    stored,
  });
  expect(recovery.read(draft.date)?.journalMarkdown).toBe(
    'Keep me on the writing page.',
  );
});

it('identifies an unmounted failed day and lets that day recover on remount', async () => {
  const recovery = memoryRecovery();
  const registry = createTestAutosaveRegistry(() => recovery);
  const first = registry.acquire(stored, () =>
    Promise.reject(new TypeError('offline')),
  );
  const unsubscribe = first.subscribe(() => undefined);
  first.edit({ journalMarkdown: 'Recover this day.' });
  first.flush();
  unsubscribe();
  await settleEffects();

  await expect(registry.settle()).rejects.toMatchObject({
    date: draft.date,
    failure: { kind: 'network', message: journalWriteMessage },
  });

  const remounted = registry.acquire(stored, () =>
    Promise.resolve({ revision: 101 }),
  );
  expect(remounted).toBe(first);
  remounted.flush();
  await registry.settle();

  expect(remounted.snapshot()).toMatchObject({
    draft: {
      ...draft,
      journalMarkdown: 'Recover this day.',
      baseRevision: 101,
    },
    failure: undefined,
    inFlight: undefined,
    stored: {
      draft: {
        ...draft,
        journalMarkdown: 'Recover this day.',
        baseRevision: 101,
      },
      revision: 101,
    },
  });
  expect(recovery.read(draft.date)).toBeUndefined();
});

it('reads again when an edit is stored during a dependent read', async () => {
  const registry = createTestAutosaveRegistry();
  const coordinator = registry.acquire(stored, () =>
    Promise.resolve({ revision: 101 }),
  );
  const unsubscribe = coordinator.subscribe(() => undefined);
  const firstRead = deferredRead<string>();
  const reads: Array<string> = [];

  const reading = registry.readAfterSettled(() => {
    const value = coordinator.snapshot().stored.draft.journalMarkdown;
    reads.push(value);
    return reads.length === 1 ? firstRead.promise : Promise.resolve(value);
  });
  await settleEffects();
  coordinator.edit({ journalMarkdown: 'Written while the archive loaded.' });
  firstRead.resolve('');

  await expect(reading).resolves.toBe('Written while the archive loaded.');
  expect(reads).toEqual(['', 'Written while the archive loaded.']);
  unsubscribe();
});

it('rejects a dependent read when an edit made during it cannot be stored', async () => {
  const recovery = memoryRecovery();
  const registry = createTestAutosaveRegistry(() => recovery);
  const coordinator = registry.acquire(stored, () =>
    Promise.reject(new TypeError('offline')),
  );
  const unsubscribe = coordinator.subscribe(() => undefined);
  const firstRead = deferredRead<string>();

  const reading = registry.readAfterSettled(() => firstRead.promise);
  await settleEffects();
  coordinator.edit({ journalMarkdown: 'Do not leave this behind.' });
  firstRead.resolve('stale archive');

  await expect(reading).rejects.toMatchObject({ date: draft.date });
  expect(coordinator.snapshot().draft.journalMarkdown).toBe(
    'Do not leave this behind.',
  );
  expect(recovery.read(draft.date)?.journalMarkdown).toBe(
    'Do not leave this behind.',
  );
  unsubscribe();
});
