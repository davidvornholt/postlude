/**
 * React's adapter for the day-scoped autosave coordinator.
 *
 * The hook subscribes the component and translates visibility, page exit, and
 * unmount signals. The coordinator owns requests and timers. The registry,
 * draft recovery, and confirmed-revision tracker own state that outlives a
 * component.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  type AutosaveFailure,
  type ConfirmedDraft,
  openAutosave,
  type SaveStatus,
  saveStatus,
} from '../autosave.ts';
import type {
  AutosaveCoordinator,
  SaveDraft,
} from '../autosave-coordinator.ts';
import { createAutosaveRegistry } from '../autosave-registry.ts';
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

const coordinators = createAutosaveRegistry(browserDraftRecovery);

const coordinatorFor = (
  stored: ConfirmedDraft,
  save: SaveDraft,
): AutosaveCoordinator => coordinators.acquire(stored, save);

const doNothing = (): void => undefined;
const browserAvailable = (): boolean =>
  typeof globalThis.window !== 'undefined';

export const useAutosave = (
  stored: ConfirmedDraft,
  save: SaveDraft,
): Autosave => {
  const {
    draft: {
      date,
      journalMarkdown,
      scriptureMarkdown,
      scriptureReference,
      baseRevision,
    },
    revision,
  } = stored;
  const stableStored = useMemo<ConfirmedDraft>(
    () => ({
      draft: {
        date,
        journalMarkdown,
        scriptureMarkdown,
        scriptureReference,
        baseRevision,
      },
      revision,
    }),
    [
      baseRevision,
      date,
      journalMarkdown,
      revision,
      scriptureMarkdown,
      scriptureReference,
    ],
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
