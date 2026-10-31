/**
 * The seam where the agent note is written.
 *
 * Postlude decides when a note is needed and stores what comes back.
 * `AgentNotes` asks for a note when a day is closed and when David asks for a
 * new one, and hands this service everything the note may be written from.
 * Writing it, with whichever model and prompt, belongs to the implementation
 * behind this service and to nothing else.
 *
 * `bedrock-agent-note-generator.ts` is the implementation the journal runtime
 * provides. Where it has no credentials, it fails like `notConfigured`, which
 * fails every request with a message the page can show, so a closed day says
 * plainly that no note was written rather than waiting forever for one.
 *
 * An implementation:
 *
 * - provides a layer for `AgentNoteGenerator`;
 * - returns the note as plain text and names the model that wrote it;
 * - fails with `AgentNoteGenerationError`, whose message is shown to David, so
 *   it says what went wrong without credentials, prompts, or journal text;
 * - finishes within `agentNoteTimeout`, after which the request is recorded as
 *   failed and its result, if it ever arrives, is dropped.
 *
 * It runs after the request that asked for it has returned, so nothing waits on
 * it, and a newer request for the same day supersedes it.
 */

import { Context, Duration, Effect, Layer } from 'effect';

import { AgentNoteGenerationError } from '../errors/journal-errors.ts';
import {
  agentNoteTimeoutMinutes,
  type WrapArea,
} from '../schemas/agent-area.ts';
import type { DayOverview } from '../schemas/day-overview.ts';
import type { DayRating } from '../schemas/day-rating.ts';
import type { JournalEntry } from '../schemas/entry.ts';

/** How long one note may take before it counts as failed. */
export const agentNoteTimeout = Duration.minutes(agentNoteTimeoutMinutes);

/** How many earlier days a note is given, for the trends it may mention. */
export const agentNoteHistoryDays = 14;

/** Everything a note may be written from, read together for one day. */
export type AgentNoteInput = {
  readonly date: string;
  /** The day's entry; an empty one, revision 0, if David wrote nothing. */
  readonly entry: JournalEntry;
  readonly rating: DayRating;
  /** The /wrap metrics and report; all null if /wrap hasn't run for the day. */
  readonly wrap: WrapArea;
  /** The days before, oldest first, without their prose. */
  readonly history: ReadonlyArray<DayOverview>;
};

export type AgentNoteDraft = {
  /** Plain text: the page shows it as written, without rendering markup. */
  readonly note: string;
  /** The model that wrote it, as the page should name it. */
  readonly model: string;
};

export const notConfiguredMessage =
  'No agent note generator is set up yet, so no note was written.';

export class AgentNoteGenerator extends Context.Service<
  AgentNoteGenerator,
  {
    readonly generate: (
      input: AgentNoteInput,
    ) => Effect.Effect<AgentNoteDraft, AgentNoteGenerationError>;
  }
>()('journal/AgentNoteGenerator') {
  static readonly notConfigured = Layer.succeed(
    AgentNoteGenerator,
    AgentNoteGenerator.of({
      generate: () =>
        Effect.fail(
          new AgentNoteGenerationError({ message: notConfiguredMessage }),
        ),
    }),
  );
}
