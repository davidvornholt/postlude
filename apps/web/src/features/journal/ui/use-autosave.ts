/**
 * React's view of the day-scoped autosave coordinator.
 *
 * The component subscribes, edits, and asks for a flush. It owns no request,
 * timer, or recovery data, so navigating away cannot destroy a save queue that
 * still has work in it.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  type AutosaveFailure,
  openAutosave,
  type SaveStatus,
  saveStatus,
} from '../autosave.ts';
import {
  type AutosaveCoordinator,
  createAutosaveCoordinator,
  type SaveDraft,
} from '../autosave-coordinator.ts';
import { browserDraftRecovery } from '../recoverable-draft.ts';
import type { EntryDraft } from '../schemas/entry.ts';

export type { SaveDraft } from '../autosave-coordinator.ts';

export type Autosave = {
  readonly status: SaveStatus;
  readonly failure: AutosaveFailure | undefined;
  readonly draft: EntryDraft;
  readonly edit: (fields: Partial<EntryDraft>) => void;
  /** Save now because the writer left a field or asked to retry. */
  readonly flush: () => void;
};

const coordinators = new Map<string, AutosaveCoordinator>();

const coordinatorFor = (
  stored: EntryDraft,
  save: SaveDraft,
): AutosaveCoordinator => {
  const existing = coordinators.get(stored.date);
  if (existing !== undefined) {
    existing.update(stored, save);
    return existing;
  }
  const created = createAutosaveCoordinator({
    stored,
    save,
    recovery: browserDraftRecovery(),
  });
  coordinators.set(stored.date, created);
  return created;
};

const doNothing = (): void => undefined;
const browserAvailable = (): boolean =>
  typeof globalThis.window !== 'undefined';

export const useAutosave = (stored: EntryDraft, save: SaveDraft): Autosave => {
  const { date, journalMarkdown, scriptureMarkdown, scriptureReference } =
    stored;
  const stableStored = useMemo<EntryDraft>(
    () => ({ date, journalMarkdown, scriptureMarkdown, scriptureReference }),
    [date, journalMarkdown, scriptureMarkdown, scriptureReference],
  );
  const serverState = useMemo(() => openAutosave(stableStored), [stableStored]);
  const coordinator = useMemo<AutosaveCoordinator | undefined>(
    () => (browserAvailable() ? coordinatorFor(stableStored, save) : undefined),
    [save, stableStored],
  );
  const subscribe = useCallback(
    (listener: () => void) => coordinator?.subscribe(listener) ?? doNothing,
    [coordinator],
  );
  const snapshot = useCallback(
    () => coordinator?.snapshot() ?? serverState,
    [coordinator, serverState],
  );
  const state = useSyncExternalStore(subscribe, snapshot, () => serverState);

  useEffect(() => {
    if (coordinator === undefined) {
      return;
    }
    coordinator.update(stableStored, save);
    coordinator.flush();
    return coordinator.leave;
  }, [coordinator, save, stableStored]);

  useEffect(() => {
    if (coordinator === undefined) {
      return;
    }
    const saveAtLifecycleBoundary = () => coordinator.visibilityChanged();
    globalThis.document.addEventListener(
      'visibilitychange',
      saveAtLifecycleBoundary,
    );
    globalThis.window.addEventListener('pagehide', saveAtLifecycleBoundary);
    return () => {
      globalThis.document.removeEventListener(
        'visibilitychange',
        saveAtLifecycleBoundary,
      );
      globalThis.window.removeEventListener(
        'pagehide',
        saveAtLifecycleBoundary,
      );
    };
  }, [coordinator]);

  const status = saveStatus(state);
  useEffect(() => {
    if (status === 'saved') {
      return;
    }
    const confirmLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    globalThis.window.addEventListener('beforeunload', confirmLeaving);
    return () =>
      globalThis.window.removeEventListener('beforeunload', confirmLeaving);
  }, [status]);

  return {
    status,
    failure: state.failure,
    draft: state.draft,
    edit: coordinator?.edit ?? doNothing,
    flush: coordinator?.flush ?? doNothing,
  };
};
