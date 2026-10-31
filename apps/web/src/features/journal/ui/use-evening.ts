/**
 * The evening's state: the day's ratings, whether it is closed, and its agent
 * note, kept in step with the server.
 *
 * A rating shows as chosen at once and is saved behind it. Every call goes
 * through one queue for its day, in the order it was made, so two quick
 * choices can't land in the wrong order and closing the day waits for the
 * ratings before it. A rating whose save failed falls back to the stored one
 * and says why.
 *
 * The queue outlives the page, so leaving the day and coming back keeps that
 * order. A page that comes back while earlier calls are still on their way
 * loaded the evening before they landed, so it reads the evening again once
 * they have.
 *
 * Closing the day and asking for a new note first wait for the writing to be
 * saved, because the note is written from the stored entry: closing a moment
 * after the last keystroke would otherwise write it from the text as it was a
 * few seconds earlier.
 */

import { useEffect, useState } from 'react';

import { settleBrowserAutosaves } from '../browser-autosaves.ts';
import {
  eveningFailureMessageOf,
  unsavedWritingMessage,
} from '../evening-failure.ts';
import type { AgentNoteView, WrapArea } from '../schemas/agent-area.ts';
import type { DayRating } from '../schemas/day-rating.ts';
import type { EveningActions, EveningView } from '../services/evening-fns.ts';

type RatingValues = Pick<DayRating, 'energy' | 'progress' | 'repeatDay'>;

export type EveningBusy = 'closing' | 'reopening' | 'regenerating';

export type Evening = {
  /** The stored ratings, with any choice still being saved shown over them. */
  readonly rating: DayRating;
  readonly wrap: WrapArea;
  /** The note as the server reported it, stale once the entry moved on. */
  readonly agentNote: AgentNoteView;
  readonly busy: EveningBusy | undefined;
  readonly failure: string | undefined;
  readonly rate: (change: Partial<RatingValues>) => void;
  readonly close: () => void;
  readonly reopen: () => void;
  readonly regenerate: () => void;
};

/**
 * How soon a pending note is looked at again: soon at first, since most notes
 * take seconds, then less often, up to a ceiling.
 */
const firstPollDelayMs = 2000;
const pollDelayGrowth = 1.5;
const longestPollDelayMs = 15_000;

const pollDelayMs = (attempt: number): number =>
  Math.min(firstPollDelayMs * pollDelayGrowth ** attempt, longestPollDelayMs);

/** Each day's queue, dropped once it runs dry. */
const queues = new Map<string, Promise<void>>();

const enqueue = (date: string, task: () => Promise<void>): void => {
  const queue: Promise<void> = (queues.get(date) ?? Promise.resolve())
    .then(task)
    .then(() => {
      if (queues.get(date) === queue) {
        queues.delete(date);
      }
    });
  queues.set(date, queue);
};

const withoutSettled = (
  overlay: Partial<RatingValues>,
  change: Partial<RatingValues>,
): Partial<RatingValues> => {
  const remaining: Record<string, unknown> = { ...overlay };
  for (const [key, value] of Object.entries(change)) {
    if (remaining[key] === value) {
      delete remaining[key];
    }
  }
  return remaining as Partial<RatingValues>;
};

/**
 * The note's status with the entry's latest saved revision taken into account:
 * writing saved after the note was written makes it stale even though the
 * server called it current when the page loaded.
 */
const currentNoteOf = (
  note: AgentNoteView,
  entryRevision: number,
): AgentNoteView =>
  note.status === 'ready' &&
  note.basedOnRevision !== null &&
  entryRevision > note.basedOnRevision
    ? { ...note, status: 'stale' }
    : note;

const usePendingNote = (
  note: AgentNoteView,
  date: string,
  readEvening: EveningActions['readEvening'],
  update: (note: AgentNoteView) => void,
) => {
  // Asking for a new note keeps the status pending, so each poll is tied to one
  // request by its time. A new request ends the old poll, and an answer still
  // on its way to that poll is dropped.
  const request =
    note.status === 'pending' ? (note.requestedAt?.getTime() ?? 0) : undefined;
  useEffect(() => {
    if (request === undefined) {
      return;
    }
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      timer = setTimeout(look, pollDelayMs(attempt));
      attempt += 1;
    };
    const look = (): void => {
      if (globalThis.document?.visibilityState === 'hidden') {
        schedule();
        return;
      }
      readEvening(date).then(
        (evening) => {
          if (stopped) {
            return;
          }
          update(evening.agentNote);
          if (evening.agentNote.status === 'pending') {
            schedule();
          }
        },
        () => {
          if (!stopped) {
            schedule();
          }
        },
      );
    };
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [request, date, readEvening, update]);
};

export const useEvening = (
  initial: EveningView,
  actions: EveningActions,
  entryRevision: number,
): Evening => {
  const { date } = initial;
  const [stored, setStored] = useState(initial.rating);
  const [overlay, setOverlay] = useState<Partial<RatingValues>>({});
  const [agentNote, setAgentNote] = useState(initial.agentNote);
  const [busy, setBusy] = useState<EveningBusy | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  const { readEvening } = actions;

  // Calls queued on an earlier visit to the day are still on their way.
  useEffect(() => {
    if (!queues.has(date)) {
      return;
    }
    enqueue(date, async () => {
      try {
        const evening = await readEvening(date);
        setStored(evening.rating);
        setAgentNote(evening.agentNote);
      } catch (error) {
        setFailure(eveningFailureMessageOf(error));
      }
    });
  }, [date, readEvening]);

  usePendingNote(agentNote, date, readEvening, setAgentNote);

  const rate = (change: Partial<RatingValues>): void => {
    setFailure(undefined);
    setOverlay((current) => ({ ...current, ...change }));
    enqueue(date, async () => {
      try {
        setStored(await actions.saveRating({ date, ...change }));
      } catch (error) {
        setFailure(eveningFailureMessageOf(error));
      } finally {
        setOverlay((current) => withoutSettled(current, change));
      }
    });
  };

  /** Runs one action of the day, with the writing saved first if it needs it. */
  const act = (
    kind: EveningBusy,
    run: () => Promise<void>,
    afterWriting: boolean,
  ): void => {
    setFailure(undefined);
    setBusy(kind);
    enqueue(date, async () => {
      try {
        if (afterWriting) {
          try {
            await settleBrowserAutosaves();
          } catch {
            setFailure(unsavedWritingMessage);
            return;
          }
        }
        await run();
      } catch (error) {
        setFailure(eveningFailureMessageOf(error));
      } finally {
        setBusy(undefined);
      }
    });
  };

  return {
    rating: { ...stored, ...overlay },
    wrap: initial.wrap,
    agentNote: currentNoteOf(agentNote, entryRevision),
    busy,
    failure,
    rate,
    close: () =>
      act(
        'closing',
        async () => {
          const closed = await actions.closeDay(date);
          setStored(closed.rating);
          setAgentNote(closed.agentNote);
        },
        true,
      ),
    reopen: () =>
      act(
        'reopening',
        async () => setStored(await actions.reopenDay(date)),
        false,
      ),
    regenerate: () =>
      act(
        'regenerating',
        async () => setAgentNote(await actions.regenerateNote(date)),
        true,
      ),
  };
};
