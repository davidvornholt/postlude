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
  type AutosaveFailure,
  type AutosaveState,
  advanceAutosave,
  openAutosave,
  sameDraft,
} from './autosave.ts';
import {
  invalidScriptureReferenceMessage,
  journalWriteMessage,
} from './errors/journal-errors.ts';
import type { DraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft } from './schemas/entry.ts';

export type SaveDraft = (draft: EntryDraft) => Promise<unknown>;

export const authenticationSaveMessage =
  'Your sign-in ended before this entry could be saved. Your words are kept in this tab.';
const unauthorizedStatus = 401;
const forbiddenStatus = 403;

const errorProperty = (error: unknown, key: string): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/** Reduces browser failures to messages that are safe and useful to act on. */
export const autosaveFailureOf = (error: unknown): AutosaveFailure => {
  const status = errorProperty(error, 'status');
  if (status === unauthorizedStatus || status === forbiddenStatus) {
    return { kind: 'authentication', message: authenticationSaveMessage };
  }

  const message = errorProperty(error, 'message');
  if (
    typeof message === 'string' &&
    message.includes(invalidScriptureReferenceMessage)
  ) {
    return {
      kind: 'validation',
      field: 'scriptureReference',
      message: invalidScriptureReferenceMessage,
    };
  }

  return { kind: 'network', message: journalWriteMessage };
};

type CoordinatorOptions = {
  readonly stored: EntryDraft;
  readonly save: SaveDraft;
  readonly recovery: DraftRecovery;
  readonly quietPeriodMs?: number;
};

export type AutosaveCoordinator = {
  readonly snapshot: () => AutosaveState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly edit: (fields: Partial<EntryDraft>) => void;
  readonly flush: () => void;
  readonly leave: () => void;
  readonly visibilityChanged: () => void;
  readonly update: (stored: EntryDraft, save: SaveDraft) => void;
};

const defaultQuietPeriodMs = 1200;

export const createAutosaveCoordinator = ({
  stored,
  save,
  recovery,
  quietPeriodMs = defaultQuietPeriodMs,
}: CoordinatorOptions): AutosaveCoordinator => {
  const recovered = recovery.read(stored.date);
  let state: AutosaveState = {
    ...openAutosave(stored),
    draft: recovered ?? stored,
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
    if (state.inFlight === undefined && sameDraft(state.draft, state.stored)) {
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
        try: () => saving(command.draft),
        catch: autosaveFailureOf,
      }).pipe(
        Effect.match({
          onFailure: (failure) => dispatch({ _tag: 'failed', failure }),
          onSuccess: () => dispatch({ _tag: 'stored' }),
        }),
      ),
    );
  };

  dispatch = (event) => {
    const [next, commands] = advanceAutosave(state, event);
    state = next;
    keepRecoveryInStep();
    publish();
    for (const command of commands) {
      runCommand(command);
    }
  };

  keepRecoveryInStep();

  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
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
      if (
        state.inFlight === undefined &&
        sameDraft(state.draft, state.stored) &&
        !sameDraft(state.stored, nextStored)
      ) {
        state = openAutosave(nextStored);
        keepRecoveryInStep();
        publish();
      }
    },
  };
};
