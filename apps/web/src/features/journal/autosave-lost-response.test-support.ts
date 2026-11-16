/**
 * The tab and server for the lost-response tests: the real coordinator and
 * leave guard against an in-memory server that checks the base revision and
 * stores the passage line the way the entry repository does.
 */

import { saveStatus } from './autosave.ts';
import {
  createAutosaveCoordinator,
  type SaveDraft,
} from './autosave-coordinator.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';
import { createLeaveGuard } from './leave-guard.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import { decodeSaveConfirmation } from './save-confirmation.ts';
import type { EntryDraft, SaveConfirmation } from './schemas/entry.ts';
import {
  parseScriptureReference,
  scriptureLineOf,
  scriptureTopicOf,
} from './scripture-reference.ts';

export const original: EntryDraft = {
  date: '2026-11-15',
  journalMarkdown: 'Original words',
  scriptureMarkdown: '',
  scriptureReference: '',
  baseRevision: 1,
};
const writeConflictStatus = 409;

export const settleEffects = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** The passage line the day page shows after the repository stored `line`. */
const readBack = (line: string): string =>
  scriptureLineOf({
    scriptureReference: parseScriptureReference(line),
    scriptureTopic: scriptureTopicOf(line),
  });

/**
 * Commits like the entry repository, then lets a test lose the response or
 * hold it back.
 */
export const fakeServer = (start: EntryDraft = original) => {
  let held = { draft: start, revision: 1 };
  const lost: Array<() => void> = [];
  const heldBack: Array<() => void> = [];
  let loseNextResponse = false;
  let holdNextResponse = false;
  let expiredSessionStatus: number | undefined;
  const answer = (
    response: () => Promise<SaveConfirmation>,
  ): Promise<SaveConfirmation> => {
    if (!holdNextResponse) {
      return response();
    }
    holdNextResponse = false;
    return new Promise((resolve, reject) => {
      heldBack.push(() => response().then(resolve, reject));
    });
  };
  const save = (draft: EntryDraft): Promise<SaveConfirmation> =>
    answer(() => commit(draft));
  const commit = (draft: EntryDraft): Promise<SaveConfirmation> => {
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
    held = {
      draft: {
        ...draft,
        // Like the repository, an unchanged stored line is kept as it was.
        scriptureReference:
          draft.scriptureReference.trim() === held.draft.scriptureReference
            ? held.draft.scriptureReference
            : readBack(draft.scriptureReference),
        baseRevision: revision,
      },
      revision,
    };
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
    holdNextResponse: () => {
      holdNextResponse = true;
    },
    releaseResponses: () => {
      for (const release of heldBack.splice(0)) {
        release();
      }
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

export const openDay = (
  save: (server: ReturnType<typeof fakeServer>) => SaveDraft = (server) =>
    server.save,
  start: EntryDraft = original,
) => {
  const server = fakeServer(start);
  const tab = guardedTab();
  const coordinator = createAutosaveCoordinator({
    stored: { draft: start, revision: 1 },
    save: save(server),
    recovery: tab.recovery,
    quietPeriodMs: 0,
  });
  return { server, tab, coordinator };
};

/** What the writer would see, keep and be asked when closing the tab. */
export const observe = ({ tab, coordinator }: ReturnType<typeof openDay>) => ({
  displayed: coordinator.snapshot().draft.journalMarkdown,
  status: saveStatus(coordinator.snapshot()),
  recovery: tab.retained()?.journalMarkdown,
  closingIsQuestioned: tab.closingIsQuestioned(),
});

/** What the day route does when its loader returns a fresh server copy. */
export const reloadRoute = ({
  server,
  coordinator,
}: ReturnType<typeof openDay>) => {
  coordinator.update(server.held(), server.save);
  coordinator.flush();
};

export const saveFromAnotherTab = async (
  server: ReturnType<typeof fakeServer>,
  journalMarkdown: string,
): Promise<void> => {
  const { draft, revision } = server.held();
  await server.save({ ...draft, journalMarkdown, baseRevision: revision });
};

export const savedAs = (journalMarkdown: string) => ({
  displayed: journalMarkdown,
  status: 'saved' as const,
  recovery: undefined,
  closingIsQuestioned: false,
});

export const conflictKeeping = (journalMarkdown: string) => ({
  displayed: journalMarkdown,
  status: 'failed' as const,
  recovery: journalMarkdown,
  closingIsQuestioned: true,
});
