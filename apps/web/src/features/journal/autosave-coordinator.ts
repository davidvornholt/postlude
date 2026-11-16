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
  type AutosaveEvent,
  type AutosaveState,
  advanceAutosave,
  type ConfirmedDraft,
  hasUnconfirmedWrite,
  openAutosave,
  sameDraft,
  saveStatus,
} from './autosave.ts';
import { autosaveFailureOf } from './autosave-error.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import { decodeSaveConfirmation } from './save-confirmation.ts';
import type { EntryDraft } from './schemas/entry.ts';
import { storedScriptureLineOf } from './scripture-reference.ts';

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

/**
 * The server copy is exactly a snapshot this tab sent without learning the
 * outcome, as the repository stores it, at the revision that send would have
 * created. Even if another tab happened to write the same text at that
 * revision, building on it loses nothing of theirs.
 */
const isOwnLostWrite = (
  state: AutosaveState,
  nextStored: ConfirmedDraft,
): boolean =>
  state.unconfirmedWrites.some(
    (sent) =>
      nextStored.revision === sent.baseRevision + 1 &&
      sameDraft(
        {
          ...sent,
          scriptureReference: storedScriptureLineOf(sent.scriptureReference),
        },
        nextStored.draft,
      ),
  );

const reconcileServerState = (
  state: AutosaveState,
  nextStored: ConfirmedDraft,
): AutosaveState | undefined => {
  if (nextStored.revision <= state.stored.revision) {
    return undefined;
  }
  // After a conflict or a possibly committed write the old confirmed copy says
  // nothing about the server. A fresh copy matching the screen settles it, and
  // one that is this tab's own lost write becomes the base for the screen.
  // Any other copy keeps the old base, so the next send is refused rather
  // than overwriting a write this tab never saw.
  if (state.failure?.kind === 'conflict' || hasUnconfirmedWrite(state)) {
    if (sameDraft(state.draft, nextStored.draft)) {
      return openAutosave(nextStored);
    }
    if (isOwnLostWrite(state, nextStored)) {
      return {
        ...openAutosave(nextStored),
        draft: { ...state.draft, baseRevision: nextStored.revision },
      };
    }
    return { ...state, stored: nextStored };
  }
  return sameDraft(state.draft, state.stored.draft)
    ? openAutosave(nextStored)
    : undefined;
};

const newerServerState = (
  kept: ConfirmedDraft | undefined,
  arrived: ConfirmedDraft,
): ConfirmedDraft =>
  kept === undefined || arrived.revision > kept.revision ? arrived : kept;

const keepRecoveryInStep = (
  state: AutosaveState,
  recovery: DraftRecovery,
): void => {
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

const sendSave = (
  saving: SaveDraft,
  draft: EntryDraft,
  dispatch: (event: AutosaveEvent) => void,
): void => {
  Effect.runFork(
    Effect.tryPromise({
      try: async () => decodeSaveConfirmation(await saving(draft)),
      catch: autosaveFailureOf,
    }).pipe(
      Effect.match({
        onFailure: (failure) => dispatch({ _tag: 'failed', failure }),
        onSuccess: ({ revision }) => dispatch({ _tag: 'stored', revision }),
      }),
    ),
  );
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
  // A server copy that arrived while a save was in flight, weighed once the
  // save settles, because its answer may be the conflict this copy resolves.
  let deferredServerState: ConfirmedDraft | undefined;
  let scheduled: Fiber.Fiber<void, never> | undefined;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const cancelScheduled = (): void => {
    const pending = scheduled;
    scheduled = undefined;
    if (pending !== undefined) {
      Effect.runFork(Fiber.interrupt(pending));
    }
  };

  let dispatch: (event: AutosaveEvent) => void;

  const acceptServerState = (nextStored: ConfirmedDraft): boolean => {
    if (state.inFlight !== undefined) {
      deferredServerState = newerServerState(deferredServerState, nextStored);
      return false;
    }
    const reconciled = reconcileServerState(state, nextStored);
    if (reconciled === undefined) {
      return false;
    }
    state = reconciled;
    keepRecoveryInStep(state, recovery);
    publish();
    return true;
  };

  /** Weigh a deferred server copy, then save on whatever base it left. */
  const acceptDeferredServerState = (): void => {
    const deferred = deferredServerState;
    if (deferred === undefined || state.inFlight !== undefined) {
      return;
    }
    deferredServerState = undefined;
    if (acceptServerState(deferred)) {
      dispatch({ _tag: 'flush' });
    }
  };

  const reportIdle = (): void => {
    if (
      listeners.size === 0 &&
      scheduled === undefined &&
      saveStatus(state) === 'saved'
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
    sendSave(saving, command.draft, dispatch);
  };

  dispatch = (event) => {
    const wasSaving = state.inFlight !== undefined;
    const [next, commands] = advanceAutosave(state, event);
    state = next;
    keepRecoveryInStep(state, recovery);
    publish();
    if (event._tag === 'stored' && wasSaving) {
      onConfirmed?.(state.stored);
    }
    for (const command of commands) {
      runCommand(command);
    }
    acceptDeferredServerState();
    reportIdle();
  };

  keepRecoveryInStep(state, recovery);

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
      acceptServerState(nextStored);
    },
  };
};
