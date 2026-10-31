/**
 * When an agent note is asked for, and what becomes of the answer.
 *
 * Closing a day asks for a note, and so does asking for a new one on a closed
 * day. Either marks the day's note pending and returns at once; the note is
 * written after the response has gone, by `AgentNoteGenerator`, and stored only
 * if no newer request for the day came in meanwhile. A failure is stored too,
 * with its message, so the page never waits on a note that isn't coming. The
 * previous note stays on the row through all of this, until a new one replaces
 * it.
 *
 * Reopening a day doesn't touch its note. Editing the entry afterwards makes
 * the note stale rather than removing it, and closing the day again asks for a
 * new one.
 */

import { Cause, Clock, Context, Effect, Layer } from 'effect';
import { SqlClient } from 'effect/sql';

import {
  AgentNoteGenerationError,
  JournalValidationError,
} from '../errors/journal-errors.ts';
import { closedDayNeededMessage } from '../evening-messages.ts';
import { shiftJournalDate } from '../journal-day.ts';
import { agentNoteViewOf } from '../schemas/agent-area.ts';
import { emptyJournalEntry } from '../schemas/entry.ts';
import {
  AgentAreaRepository,
  type NoteRequest,
} from './agent-area-repository.ts';
import {
  AgentNoteGenerator,
  agentNoteHistoryDays,
  agentNoteTimeout,
} from './agent-note-generator.ts';
import { DayRatingRepository } from './day-rating-repository.ts';
import { EntryRepository } from './entry-repository.ts';
import { inRepeatableReadSnapshot } from './read-snapshot.ts';

export const timedOutMessage =
  'Writing the note took too long, so it was stopped. Ask for a new one to try again.';
export const unexpectedFailureMessage =
  'The note could not be written. Ask for a new one to try again.';

/**
 * What the page says about a note that failed. Only the generator's own
 * message is shown as it is; any other failure may carry a statement or a
 * connection string, so it gets the generic message.
 */
const failureMessageOf = (error: unknown) => {
  if (error instanceof AgentNoteGenerationError) {
    return error.message;
  }
  return Cause.isTimeoutError(error)
    ? timedOutMessage
    : unexpectedFailureMessage;
};

/** How a note's writing is started once its request is stored. */
type Launch = (write: Effect.Effect<void>) => Effect.Effect<void>;

/** In production: after the response, on a fiber nothing waits for. */
const inBackground: Launch = (write) =>
  Effect.forkDetach(write).pipe(Effect.asVoid);

/**
 * In tests: before the request returns, inside the test's transaction, so the
 * result can be read back and is rolled back with everything else.
 */
const awaited: Launch = (write) => write;

const makeAgentNotes = (launch: Launch) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const areas = yield* AgentAreaRepository;
    const ratings = yield* DayRatingRepository;
    const entries = yield* EntryRepository;
    const generator = yield* AgentNoteGenerator;

    const inputFor = (date: string) =>
      inRepeatableReadSnapshot(
        sql,
        Effect.all({
          entry: entries
            .read(date)
            .pipe(Effect.map((entry) => entry ?? emptyJournalEntry(date))),
          rating: ratings.read(date),
          wrap: areas.readWrap(date),
          history: areas.listDays(
            shiftJournalDate(date, -agentNoteHistoryDays),
            shiftJournalDate(date, -1),
          ),
        }),
      ).pipe(Effect.map((parts) => ({ date, ...parts })));

    const recordFailure = (
      date: string,
      request: NoteRequest,
      message: string,
    ) => areas.recordNoteFailure(date, request, message).pipe(Effect.asVoid);

    /**
     * Writes and stores one requested note. It can't fail: whatever goes wrong
     * is stored as the request's failure, and what can't even be stored is
     * logged.
     */
    const write = (date: string, request: NoteRequest): Effect.Effect<void> =>
      Effect.gen(function* () {
        const input = yield* inputFor(date);
        const draft = yield* generator
          .generate(input)
          .pipe(Effect.timeout(agentNoteTimeout));
        yield* areas.recordNote(date, request, {
          note: draft.note,
          model: draft.model,
          basedOnRevision: input.entry.revision,
        });
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning('An agent note was not written.', error).pipe(
            Effect.andThen(
              recordFailure(date, request, failureMessageOf(error)),
            ),
          ),
        ),
        Effect.catchDefect((defect) =>
          Effect.logError('Writing an agent note died.', defect).pipe(
            Effect.andThen(
              recordFailure(date, request, unexpectedFailureMessage),
            ),
          ),
        ),
        Effect.catchCause((cause) =>
          Effect.logError('An agent note failure was not stored.', cause),
        ),
      );

    /** The note as the page shows it. */
    const read = (date: string) =>
      Effect.all([areas.readNote(date), Clock.currentTimeMillis]).pipe(
        Effect.map(([stored, now]) => agentNoteViewOf(stored, new Date(now))),
      );

    const requestNote = (date: string) =>
      areas
        .markNotePending(date)
        .pipe(Effect.flatMap((request) => launch(write(date, request))));

    /**
     * Closes the day and asks for its note. A day that was closed already
     * keeps the note it has; asking again is `regenerate`.
     */
    const closeDay = (date: string) =>
      Effect.gen(function* () {
        const closing = yield* ratings.close(date);
        if (closing.closedNow) {
          yield* requestNote(date);
        }
        return { rating: closing.rating, agentNote: yield* read(date) };
      });

    /** Asks for a new note for a closed day, superseding any in progress. */
    const regenerate = (date: string) =>
      Effect.gen(function* () {
        const rating = yield* ratings.read(date);
        if (rating.closedAt === null) {
          return yield* new JournalValidationError({
            message: closedDayNeededMessage,
          });
        }
        yield* requestNote(date);
        return yield* read(date);
      });

    return { read, closeDay, regenerate } as const;
  });

export class AgentNotes extends Context.Service<
  AgentNotes,
  Effect.Success<ReturnType<typeof makeAgentNotes>>
>()('journal/AgentNotes') {
  static readonly layer = Layer.effect(
    AgentNotes,
    makeAgentNotes(inBackground),
  );

  /** Writes each note before the request returns. For tests only. */
  static readonly layerAwaited = Layer.effect(
    AgentNotes,
    makeAgentNotes(awaited),
  );
}
