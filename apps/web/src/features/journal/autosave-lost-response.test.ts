/**
 * A save whose response is lost may still have been committed. These tests run
 * the real coordinator, leave guard and registry against an in-memory server
 * that checks the base revision the way the entry repository does.
 */

import { describe, expect, it } from 'bun:test';

import { saveStatus } from './autosave.ts';
import type { createAutosaveCoordinator } from './autosave-coordinator.ts';
import {
  fakeServer,
  observe,
  openDay,
  original,
  reloadRoute,
  savedAs,
  settleEffects,
} from './autosave-lost-response.test-support.ts';
import { createTestAutosaveRegistry } from './autosave-registry.test-support.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';

const undone = 'Words I subsequently undo';

const unconfirmedUndo = {
  displayed: original.journalMarkdown,
  status: 'failed' as const,
  recovery: original.journalMarkdown,
  closingIsQuestioned: true,
};

describe('a save whose response was lost after it committed', () => {
  it('does not confirm an undo made after the failure', async () => {
    const day = openDay();
    day.server.loseNextResponse();
    day.coordinator.edit({ journalMarkdown: undone });
    day.coordinator.flush();
    day.server.dropResponses();
    await settleEffects();

    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });
    expect(observe(day)).toEqual(unconfirmedUndo);

    await settleEffects();
    expect(day.server.held().draft.journalMarkdown).toBe(undone);
    expect(day.coordinator.snapshot().failure?.kind).toBe('conflict');
    expect(observe(day)).toEqual(unconfirmedUndo);
  });

  it('does not confirm an undo made while the save was in flight', async () => {
    const day = openDay();
    day.server.loseNextResponse();
    day.coordinator.edit({ journalMarkdown: undone });
    day.coordinator.flush();
    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });
    day.server.dropResponses();
    await settleEffects();

    expect(day.server.held().draft.journalMarkdown).toBe(undone);
    expect(day.coordinator.snapshot().failure?.kind).toBe('conflict');
    expect(observe(day)).toEqual(unconfirmedUndo);
  });

  it('saves the undo once a fresh read shows the lost write', async () => {
    const day = openDay();
    day.server.loseNextResponse();
    day.coordinator.edit({ journalMarkdown: undone });
    day.coordinator.flush();
    day.server.dropResponses();
    await settleEffects();
    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });
    await settleEffects();
    expect(day.coordinator.snapshot().failure?.kind).toBe('conflict');

    reloadRoute(day);
    await settleEffects();
    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: original.journalMarkdown },
      revision: 3,
    });
    expect(observe(day)).toEqual(savedAs(original.journalMarkdown));
  });

  it('keeps navigation waiting while the server copy is unknown', async () => {
    const server = fakeServer();
    const registry = createTestAutosaveRegistry();
    const coordinator = registry.acquire(
      { draft: original, revision: 1 },
      server.save,
    );
    server.loseNextResponse();
    coordinator.edit({ journalMarkdown: undone });
    coordinator.flush();
    coordinator.edit({ journalMarkdown: original.journalMarkdown });
    server.dropResponses();
    await settleEffects();

    await expect(registry.settle()).rejects.toThrow(
      journalWriteConflictMessage,
    );
  });
});

describe.each([401, 403])(
  'a lost committed save followed by a refused sign-in (%d)',
  (status) => {
    const loseThenRefuse = async (
      server: ReturnType<typeof fakeServer>,
      coordinator: ReturnType<typeof createAutosaveCoordinator>,
    ): Promise<void> => {
      server.loseNextResponse();
      coordinator.edit({ journalMarkdown: undone });
      coordinator.flush();
      server.dropResponses();
      await settleEffects();
      server.expireSession(status);
      coordinator.flush();
      await settleEffects();
      coordinator.edit({ journalMarkdown: original.journalMarkdown });
      await settleEffects();
    };

    it('does not confirm the undo', async () => {
      const day = openDay();
      await loseThenRefuse(day.server, day.coordinator);

      expect(day.server.held().draft.journalMarkdown).toBe(undone);
      expect(day.coordinator.snapshot().failure?.kind).toBe('authentication');
      expect(observe(day)).toEqual(unconfirmedUndo);
    });

    it('keeps navigation waiting and the day in memory', async () => {
      const server = fakeServer();
      const registry = createTestAutosaveRegistry();
      const coordinator = registry.acquire(
        { draft: original, revision: 1 },
        server.save,
      );
      const unsubscribe = coordinator.subscribe(() => undefined);
      await loseThenRefuse(server, coordinator);
      unsubscribe();

      await expect(registry.settle()).rejects.toMatchObject({
        failure: { kind: 'authentication' },
      });
      expect(
        registry.acquire({ draft: original, revision: 1 }, server.save),
      ).toBe(coordinator);
    });
  },
);

describe('a save that failed before it reached the database', () => {
  it('stores the undo on the next attempt', async () => {
    let reachable = false;
    const day = openDay(
      (server) => (draft) =>
        reachable
          ? server.save(draft)
          : Promise.reject(new TypeError('Failed to fetch')),
    );
    day.coordinator.edit({ journalMarkdown: undone });
    day.coordinator.flush();
    await settleEffects();
    expect(saveStatus(day.coordinator.snapshot())).toBe('failed');

    reachable = true;
    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });
    await settleEffects();

    expect(day.server.held().draft.journalMarkdown).toBe(
      original.journalMarkdown,
    );
    expect(observe(day)).toEqual({
      displayed: original.journalMarkdown,
      status: 'saved',
      recovery: undefined,
      closingIsQuestioned: false,
    });
  });
});
