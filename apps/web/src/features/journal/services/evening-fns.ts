/**
 * The evening's server functions: rating a day, closing and reopening it, and
 * reading and renewing what the agents added to it.
 *
 * Each carries `sessionRequired`, like every journal function, and decodes its
 * input before a query sees it. A day can be rated or closed once it has begun
 * by the server's clock, and not before.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { JournalValidationError } from '../errors/journal-errors.ts';
import { rejectFailedResponse } from '../evening-failure.ts';
import { futureDayMessage } from '../evening-messages.ts';
import type { AgentNoteView, WrapArea } from '../schemas/agent-area.ts';
import {
  DayInputSchema,
  type DayRating,
  type DayRatingChange,
  DayRatingChangeSchema,
} from '../schemas/day-rating.ts';
import { AgentAreaRepository } from './agent-area-repository.ts';
import { AgentNotes } from './agent-notes.ts';
import { DayRatingRepository } from './day-rating-repository.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

const decodeDay = Schema.decodeUnknownSync(DayInputSchema);
const decodeChange = Schema.decodeUnknownSync(DayRatingChangeSchema);

const begun = (date: string) =>
  date > currentJournalDate()
    ? Effect.fail(new JournalValidationError({ message: futureDayMessage }))
    : Effect.void;

/** Everything the evening shows for one day. */
export type EveningView = {
  readonly date: string;
  readonly rating: DayRating;
  /** The /wrap metrics and report, all null until /wrap has run for the day. */
  readonly wrap: WrapArea;
  readonly agentNote: AgentNoteView;
};

export type DayClosed = {
  readonly rating: DayRating;
  /** Pending when this call closed the day, as the note is being written. */
  readonly agentNote: AgentNoteView;
};

export const readEveningFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeDay(input))
  .handler(
    ({ data }): Promise<EveningView> =>
      runJournalEffect(
        Effect.gen(function* () {
          const ratings = yield* DayRatingRepository;
          const areas = yield* AgentAreaRepository;
          const notes = yield* AgentNotes;
          const [rating, wrap, agentNote] = yield* Effect.all([
            ratings.read(data.date),
            areas.readWrap(data.date),
            notes.read(data.date),
          ]);
          return { date: data.date, rating, wrap, agentNote };
        }),
      ),
  );

/**
 * Saves the ratings the change names; a rating given as null is cleared, and
 * one left out keeps its value. Every save records the scales' version. A
 * closed day refuses the change until it is reopened.
 */
export const saveDayRatingFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeChange(input))
  .handler(
    ({ data }): Promise<DayRating> =>
      runJournalEffect(
        begun(data.date).pipe(
          Effect.andThen(DayRatingRepository),
          Effect.flatMap((ratings) => ratings.save(data)),
        ),
      ),
  );

/**
 * Closes the day, which needs energy and progress, and asks for its agent
 * note. Closing a day that is already closed changes nothing.
 */
export const closeDayFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeDay(input))
  .handler(
    ({ data }): Promise<DayClosed> =>
      runJournalEffect(
        begun(data.date).pipe(
          Effect.andThen(AgentNotes),
          Effect.flatMap((notes) => notes.closeDay(data.date)),
        ),
      ),
  );

/** Opens a closed day to changes again. Its agent note stays. */
export const reopenDayFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeDay(input))
  .handler(
    ({ data }): Promise<DayRating> =>
      runJournalEffect(
        DayRatingRepository.pipe(
          Effect.flatMap((ratings) => ratings.reopen(data.date)),
        ),
      ),
  );

/** Asks for a new agent note for a closed day. */
export const regenerateAgentNoteFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeDay(input))
  .handler(
    ({ data }): Promise<AgentNoteView> =>
      runJournalEffect(
        AgentNotes.pipe(Effect.flatMap((notes) => notes.regenerate(data.date))),
      ),
  );

/**
 * The evening's server functions as the plain calls the day page takes, the
 * way `saveDraft` is for the writing. A function that answers with a failed
 * response rejects, so the page handles every failure in one place.
 */
export type EveningActions = {
  readonly readEvening: (date: string) => Promise<EveningView>;
  readonly saveRating: (change: DayRatingChange) => Promise<DayRating>;
  readonly closeDay: (date: string) => Promise<DayClosed>;
  readonly reopenDay: (date: string) => Promise<DayRating>;
  readonly regenerateNote: (date: string) => Promise<AgentNoteView>;
};

export const eveningActions: EveningActions = {
  readEvening: (date) =>
    readEveningFn({ data: { date } }).then(rejectFailedResponse),
  saveRating: (change) =>
    saveDayRatingFn({ data: change }).then(rejectFailedResponse),
  closeDay: (date) => closeDayFn({ data: { date } }).then(rejectFailedResponse),
  reopenDay: (date) =>
    reopenDayFn({ data: { date } }).then(rejectFailedResponse),
  regenerateNote: (date) =>
    regenerateAgentNoteFn({ data: { date } }).then(rejectFailedResponse),
};

/**
 * The evening as a day's page loads it. A failure leaves the evening out
 * rather than failing the page, because the writing must open even when the
 * ratings or the report can't be read.
 */
export const readEveningWithDay = (
  date: string,
): Promise<EveningView | undefined> =>
  eveningActions.readEvening(date).catch(() => undefined);
