/**
 * The wiring between the autosave rule and the browser.
 *
 * `autosave.ts` decides what should happen; this turns each decision into the
 * one thing a browser can do about it — set a timer, clear it, or post the
 * draft. Nothing is decided here, so the ordering that matters stays testable
 * as plain values rather than as a component that has to be driven.
 *
 * The state is held in a ref as well as in React state. A command has to be
 * issued against the state the event just produced, and React state is not
 * that until the next render; a reply landing mid-keystroke would otherwise be
 * applied to the draft as it was one render ago.
 *
 * Where the draft goes is passed in rather than imported. The server function
 * that writes it reaches the session guard, the connection pool, and the
 * validated server environment on its way to the database, and importing it
 * here would make every component that autosaves need all three to render.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AutosaveCommand,
  type AutosaveEvent,
  advanceAutosave,
  openAutosave,
  type SaveStatus,
  saveStatus,
} from '../autosave.ts';
import type { EntryDraft } from '../schemas/entry.ts';

/** Writes a draft, rejecting when it did not land. */
export type SaveDraft = (draft: EntryDraft) => Promise<unknown>;

/**
 * How long the writer has to stop for before the draft is posted. Long enough
 * that a sentence is one save rather than eight, short enough that putting the
 * phone down and picking it up again does not lose the thought.
 */
const quietMs = 1200;

export type Autosave = {
  readonly status: SaveStatus;
  readonly draft: EntryDraft;
  readonly edit: (fields: Partial<EntryDraft>) => void;
  /** Save now: the writer left a field, or asked again after a failure. */
  readonly flush: () => void;
};

export const useAutosave = (stored: EntryDraft, save: SaveDraft): Autosave => {
  const [state, setState] = useState(() => openAutosave(stored));
  const current = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Read through a ref for the same reason the editor's handlers are: the
  // effect below is rebuilt only when `dispatch` changes, and a caller that
  // passes a fresh arrow every render would otherwise rebuild it every render.
  const saving = useRef(save);
  useEffect(() => {
    saving.current = save;
  });

  const dispatch = useCallback((event: AutosaveEvent) => {
    const [next, commands] = advanceAutosave(current.current, event);
    current.current = next;
    setState(next);
    for (const command of commands) {
      runCommand.current(command);
    }
  }, []);

  // Declared as a ref so `dispatch` and this can name each other: a save
  // command starts a request whose reply dispatches again.
  const runCommand = useRef<(command: AutosaveCommand) => void>(
    () => undefined,
  );
  useEffect(() => {
    runCommand.current = (command) => {
      clearTimeout(timer.current);
      if (command._tag === 'schedule') {
        timer.current = setTimeout(() => dispatch({ _tag: 'quiet' }), quietMs);
        return;
      }
      if (command._tag === 'save') {
        saving.current(command.draft).then(
          () => dispatch({ _tag: 'stored' }),
          () => dispatch({ _tag: 'failed' }),
        );
      }
    };
  }, [dispatch]);

  const edit = useCallback(
    (fields: Partial<EntryDraft>) => {
      dispatch({
        _tag: 'edited',
        draft: { ...current.current.draft, ...fields },
      });
    },
    [dispatch],
  );

  const flush = useCallback(() => {
    dispatch({ _tag: 'flush' });
  }, [dispatch]);

  // Leaving the page is the last chance to write. The request outlives the
  // component, so a save started here still lands; a timer that was still
  // counting would not have.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const [, commands] = advanceAutosave(current.current, { _tag: 'flush' });
      for (const command of commands) {
        runCommand.current(command);
      }
    },
    [],
  );

  const status = saveStatus(state);

  /*
   * Closing the tab is the one exit the app cannot follow. Unmounting is not
   * involved, so the flush above never runs and the quiet period may still be
   * counting; the browser's own confirmation is what stands between a thought
   * and losing it. It is asked for only while something is genuinely unwritten,
   * so a page that is fully saved closes without a word.
   */
  useEffect(() => {
    if (status === 'saved') {
      return;
    }
    const confirmLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', confirmLeaving);
    return () => {
      window.removeEventListener('beforeunload', confirmLeaving);
    };
  }, [status]);

  return { status, draft: state.draft, edit, flush };
};
