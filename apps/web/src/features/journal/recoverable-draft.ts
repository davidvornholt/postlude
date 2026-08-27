/**
 * Short-lived browser recovery for writing the server has not confirmed yet.
 *
 * `sessionStorage` survives reloads and internal navigation but belongs to one
 * tab and disappears when that tab closes. Journal prose therefore does not
 * acquire localStorage's indefinite lifetime. A confirmed save or a full undo
 * removes the copy immediately.
 */

import { Schema } from 'effect';

import { type EntryDraft, EntryDraftSchema } from './schemas/entry.ts';

type KeyValueStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type DraftRecovery = {
  readonly read: (date: string) => EntryDraft | undefined;
  readonly retain: (draft: EntryDraft) => void;
  readonly clear: (date: string) => void;
};

const keyFor = (date: string): string => `postlude:journal-draft:v1:${date}`;
const decodeDraft = Schema.decodeUnknownSync(EntryDraftSchema);

export const createDraftRecovery = (
  storage: KeyValueStorage,
): DraftRecovery => ({
  read: (date) => {
    try {
      const encoded = storage.getItem(keyFor(date));
      if (encoded === null) {
        return;
      }
      const draft = decodeDraft(JSON.parse(encoded) as unknown);
      if (draft.date !== date) {
        storage.removeItem(keyFor(date));
        return;
      }
      return draft;
    } catch {
      try {
        storage.removeItem(keyFor(date));
      } catch {
        // Reading already failed, and removal can be denied for the same
        // reason. The malformed value is never returned to the journal.
      }
    }
  },
  retain: (draft) => {
    try {
      storage.setItem(keyFor(draft.date), JSON.stringify(draft));
    } catch {
      // The in-memory coordinator and beforeunload warning still protect the
      // draft when a browser denies or fills session storage.
    }
  },
  clear: (date) => {
    try {
      storage.removeItem(keyFor(date));
    } catch {
      // Storage access can be denied between reads. There is no broader store
      // to fall back to without giving journal prose a longer lifetime.
    }
  },
});

const unavailableDraft: EntryDraft | undefined = undefined;
const ignoreRecovery = (): void => undefined;
const noRecovery: DraftRecovery = {
  read: () => unavailableDraft,
  retain: ignoreRecovery,
  clear: ignoreRecovery,
};

export const browserDraftRecovery = (): DraftRecovery => {
  try {
    return createDraftRecovery(globalThis.window.sessionStorage);
  } catch {
    return noRecovery;
  }
};
