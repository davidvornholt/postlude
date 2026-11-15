/**
 * A save whose response is lost may still have been committed. These tests run
 * the real coordinator, leave guard and registry against an in-memory server
 * that checks the base revision the way the entry repository does.
 */

import { describe, expect, it } from 'bun:test';

import { saveStatus } from './autosave.ts';
import {
  createAutosaveCoordinator,
  type SaveDraft,
} from './autosave-coordinator.ts';
import { createTestAutosaveRegistry } from './autosave-registry.test-support.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';
import { createLeaveGuard } from './leave-guard.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import { decodeSaveConfirmation } from './save-confirmation.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';

const original: EntryDraft = {
  date: '2026-11-15',
  journalMarkdown: 'Original words',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 1,
};
const undone = 'Words I subsequently undo';
const writeConflictStatus = 409;

const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Commits like the entry repository, then lets a test lose the response. */
const fakeServer = () => {
  let held = { draft: original, revision: 1 };
  const lost: Array<() => void> = [];
  let loseNextResponse = false;
  let expiredSessionStatus: number | undefined;
  const save = (draft: EntryDraft): Promise<SaveConfirmation> => {
    if (expiredSessionStatus !== undefined) {
      return decodeSaveConfirmation(
        new Response('Sign in again', { status: expiredSessionStatus }),
      );
    }
    if (draft.baseRevision !== held.revision) {
      return decodeSaveConfirmation(
        new Response(journalWriteConflictMessage, {
          status: writeConflictStatus,
        }),
      );
    }
    const revision = held.revision + 1;
    held = { draft: { ...draft, baseRevision: revision }, revision };
    if (!loseNextResponse) {
      return Promise.resolve({ revision });
    }
    loseNextResponse = false;
    return new Promise((_, reject) => {
      lost.push(() => reject(new TypeError('Connection closed after commit')));
    });
  };
  return {
    save,
    held: () => held,
    loseNextResponse: () => {
      loseNextResponse = true;
    },
    expireSession: (status: number) => {
      expiredSessionStatus = status;
    },
    dropResponses: () => {
      for (const drop of lost.splice(0)) {
        drop();
      }
    },
  };
};

const guardedTab = () => {
  const target = new EventTarget();
  let retained: EntryDraft | undefined;
  const memory: DraftRecovery = {
    read: () => retained,
    retain: (draft) => {
      retained = draft;
    },
    clear: () => {
      retained = undefined;
    },
  };
  return {
    recovery: createLeaveGuard(() => target)(memory),
    retained: () => retained,
    closingIsQuestioned: () => {
      const closing = new Event('beforeunload', { cancelable: true });
      target.dispatchEvent(closing);
      return closing.defaultPrevented;
    },
  };
};

const openDay = (
  save: (server: ReturnType<typeof fakeServer>) => SaveDraft = (server) =>
    server.save,
) => {
  const server = fakeServer();
  const tab = guardedTab();
  const coordinator = createAutosaveCoordinator({
    stored: { draft: original, revision: 1 },
    save: save(server),
    recovery: tab.recovery,
    quietPeriodMs: 0,
  });
  return { server, tab, coordinator };
};

/** What the writer would see, keep and be asked when closing the tab. */
const observe = ({ tab, coordinator }: ReturnType<typeof openDay>) => ({
  displayed: coordinator.snapshot().draft.journalMarkdown,
  status: saveStatus(coordinator.snapshot()),
  recovery: tab.retained()?.journalMarkdown,
  closingIsQuestioned: tab.closingIsQuestioned(),
});

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

  it('keeps the undo when a fresh read shows the lost write', async () => {
    const day = openDay();
    day.server.loseNextResponse();
    day.coordinator.edit({ journalMarkdown: undone });
    day.coordinator.flush();
    day.server.dropResponses();
    await settleEffects();
    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });
    await settleEffects();

    day.coordinator.update(day.server.held(), day.server.save);
    expect(day.coordinator.snapshot().stored).toEqual(day.server.held());
    expect(observe(day)).toEqual(unconfirmedUndo);
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
