/**
 * The browser lifetime of one journal day's autosave.
 *
 * Components subscribe to this coordinator but do not own it. A request and
 * its queue therefore survive route unmounts, and the next mount for the same
 * date observes the same draft and in-flight save.
 */

import { Effect, Fiber } from 'effect';
import {
  type AutosaveCommand,
  type AutosaveState,
  advanceAutosave,
  type ConfirmedDraft,
  openAutosave,
  sameDraft,
} from './autosave.ts';
import { autosaveFailureOf } from './autosave-error.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import { decodeSaveConfirmation } from './save-confirmation.ts';
import type { EntryDraft } from './schemas/entry.ts';

export type SaveDraft = (draft: EntryDraft) => Promise<unknown>;

type CoordinatorOptions = {
  readonly stored: ConfirmedDraft;
  readonly save: SaveDraft;
  readonly recovery: DraftRecovery;
  readonly quietPeriodMs?: number;
  readonly onIdle?: () => void;
  readonly onConfirmed?: (stored: ConfirmedDraft) => void;
};

export type AutosaveCoordinator = {
  readonly snapshot: () => AutosaveState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly edit: (fields: Partial<EntryDraft>) => void;
  readonly flush: () => void;
  readonly leave: () => void;
  readonly visibilityChanged: () => void;
  readonly update: (stored: ConfirmedDraft, save: SaveDraft) => void;
};

const defaultQuietPeriodMs = 1200;

const reconcileServerState = (
  state: AutosaveState,
  nextStored: ConfirmedDraft,
): AutosaveState | undefined => {
  if (
    nextStored.revision <= state.stored.revision ||
    state.inFlight !== undefined
  ) {
    return undefined;
  }
  if (state.failure?.kind === 'conflict') {
    const draft = { ...state.draft, baseRevision: nextStored.revision };
    return sameDraft(draft, nextStored.draft)
      ? openAutosave(nextStored)
      : { ...state, draft, stored: nextStored, failure: undefined };
  }
  return sameDraft(state.draft, state.stored.draft)
    ? openAutosave(nextStored)
    : undefined;
};

export const createAutosaveCoordinator = ({
  stored,
  save,
  recovery,
  quietPeriodMs = defaultQuietPeriodMs,
  onIdle,
  onConfirmed,
}: CoordinatorOptions): AutosaveCoordinator => {
  const recovered = recovery.read(stored.draft.date);
  let state: AutosaveState = {
    ...openAutosave(stored),
    draft: recovered ?? stored.draft,
  };
  let saving = save;
  let scheduled: Fiber.RuntimeFiber<void, never> | undefined;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const keepRecoveryInStep = (): void => {
    if (
      state.inFlight === undefined &&
      state.failure === undefined &&
      sameDraft(state.draft, state.stored.draft)
    ) {
      recovery.clear(state.draft.date);
      return;
    }
    recovery.retain(state.draft);
  };

  const cancelScheduled = (): void => {
    const pending = scheduled;
    scheduled = undefined;
    if (pending !== undefined) {
      Effect.runFork(Fiber.interruptFork(pending));
    }
  };

  let dispatch: (event: Parameters<typeof advanceAutosave>[1]) => void;

  const reportIdle = (): void => {
    if (
      listeners.size === 0 &&
      scheduled === undefined &&
      state.inFlight === undefined &&
      sameDraft(state.draft, state.stored.draft)
    ) {
      onIdle?.();
    }
  };

  const runCommand = (command: AutosaveCommand): void => {
    cancelScheduled();
    if (command._tag === 'cancel') {
      return;
    }
    if (command._tag === 'schedule') {
      scheduled = Effect.runFork(
        Effect.sleep(quietPeriodMs).pipe(
          Effect.andThen(
            Effect.sync(() => {
              scheduled = undefined;
              dispatch({ _tag: 'quiet' });
            }),
          ),
        ),
      );
      return;
    }

    Effect.runFork(
      Effect.tryPromise({
        try: async () => decodeSaveConfirmation(await saving(command.draft)),
        catch: autosaveFailureOf,
      }).pipe(
        Effect.match({
          onFailure: (failure) => dispatch({ _tag: 'failed', failure }),
          onSuccess: ({ revision }) => dispatch({ _tag: 'stored', revision }),
        }),
      ),
    );
  };

  dispatch = (event) => {
    const wasSaving = state.inFlight !== undefined;
    const [next, commands] = advanceAutosave(state, event);
    state = next;
    keepRecoveryInStep();
    publish();
    if (event._tag === 'stored' && wasSaving) {
      onConfirmed?.(state.stored);
    }
    for (const command of commands) {
      runCommand(command);
    }
    reportIdle();
  };

  keepRecoveryInStep();

  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        reportIdle();
      };
    },
    edit: (fields) => {
      dispatch({ _tag: 'edited', draft: { ...state.draft, ...fields } });
    },
    flush: () => dispatch({ _tag: 'flush' }),
    leave: () => dispatch({ _tag: 'flush' }),
    visibilityChanged: () => dispatch({ _tag: 'flush' }),
    update: (nextStored, nextSave) => {
      saving = nextSave;
      const reconciled = reconcileServerState(state, nextStored);
      if (reconciled !== undefined) {
        state = reconciled;
        keepRecoveryInStep();
        publish();
      }
    },
  };
};
