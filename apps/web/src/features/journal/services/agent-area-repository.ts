/**
 * The agent area of a journal day, and the date-range overview built on it.
 *
 * The /wrap columns are read and written here for both the CLI and the page.
 * Every query the CLI reaches stays inside what the `postlude_agent` role was
 * granted: the /wrap columns of `agent_area`, and reads of `entry` and
 * `day_rating`. The agent note's columns are read and written only by the
 * server's own role, through the methods below whose names say "note".
 */

import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';

import {
  JournalValidationError,
  journalReadError,
  journalWriteError,
} from '../errors/journal-errors.ts';
import {
  emptyWrapArea,
  StoredAgentNoteFromRow,
  WrapAreaFromRow,
  type WrapPut,
} from '../schemas/agent-area.ts';
import { DayOverviewFromRow, dayRangeLimit } from '../schemas/day-overview.ts';

const decodeWrapRows = Schema.decodeUnknownEffect(
  Schema.Array(WrapAreaFromRow),
);
const decodeNoteRows = Schema.decodeUnknownEffect(
  Schema.Array(StoredAgentNoteFromRow),
);
const decodeOverviewRows = Schema.decodeUnknownEffect(
  Schema.Array(DayOverviewFromRow),
);
const RequestRow = Schema.Struct({ request: Schema.String });
const decodeRequestRows = Schema.decodeUnknownEffect(Schema.Array(RequestRow));

export const metricsDayMismatchMessage =
  'dayMetrics.day must be the day the report is stored for.';
export const dayRangeMessage = `Give a range whose start is not after its end and that spans at most ${dayRangeLimit} days.`;

/**
 * Identifies one request for a note: the time it was made, as the database
 * prints it, to the microsecond. Each request for a day is later than the one
 * before, so no two share a token.
 */
export type NoteRequest = string;

/** What a finished note generation stores. */
export type GeneratedNote = {
  readonly note: string;
  readonly model: string;
  /** The entry revision the note was written from. */
  readonly basedOnRevision: number;
};

export class AgentAreaRepository extends Context.Service<AgentAreaRepository>()(
  'journal/AgentAreaRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const readWrap = (date: string) =>
        sql`
          select entry_date, day_metrics, metrics_version, report_html, report_model, report_generated_at
          from agent_area
          where entry_date = ${date}
        `.pipe(
          Effect.flatMap(decodeWrapRows),
          Effect.map((rows) => rows[0] ?? emptyWrapArea(date)),
          Effect.mapError(journalReadError),
        );

      /**
       * Replaces the /wrap columns of a day together, and nothing else in its
       * row. The report's time is the database clock's, not the caller's.
       */
      const putWrap = (date: string, input: WrapPut) =>
        Effect.gen(function* () {
          if (input.dayMetrics.day !== date) {
            return yield* new JournalValidationError({
              message: metricsDayMismatchMessage,
            });
          }
          const rows = yield* sql`
            insert into agent_area (
              entry_date, day_metrics, metrics_version, report_html, report_model, report_generated_at
            )
            values (
              ${date},
              ${JSON.stringify(input.dayMetrics)}::jsonb,
              ${input.metricsVersion},
              ${input.reportHtml},
              ${input.reportModel},
              now()
            )
            on conflict (entry_date) do update set
              day_metrics = excluded.day_metrics,
              metrics_version = excluded.metrics_version,
              report_html = excluded.report_html,
              report_model = excluded.report_model,
              report_generated_at = excluded.report_generated_at
            returning entry_date, day_metrics, metrics_version, report_html, report_model, report_generated_at
          `.pipe(
            Effect.flatMap(decodeWrapRows),
            Effect.mapError(journalWriteError),
          );
          const [stored] = rows;
          return stored === undefined
            ? yield* journalWriteError('The agent area returned no row.')
            : stored;
        });

      /** Every day from `from` through `to`, including days with nothing stored. */
      const listDays = (from: string, to: string) =>
        Effect.gen(function* () {
          if (from > to) {
            return yield* new JournalValidationError({
              message: dayRangeMessage,
            });
          }
          return yield* sql`
            select
              days.day::date as entry_date,
              entry.journal_word_count,
              entry.scripture_word_count,
              day_rating.energy,
              day_rating.progress,
              day_rating.repeat_day,
              day_rating.rating_version,
              day_rating.closed_at,
              agent_area.day_metrics,
              agent_area.metrics_version
            from generate_series(${from}::date, ${to}::date, interval '1 day') as days(day)
            left join entry on entry.entry_date = days.day::date
            left join day_rating on day_rating.entry_date = days.day::date
            left join agent_area on agent_area.entry_date = days.day::date
            where ${to}::date - ${from}::date < ${dayRangeLimit}
            order by days.day
          `.pipe(
            Effect.flatMap(decodeOverviewRows),
            Effect.mapError(journalReadError),
            Effect.flatMap((days) =>
              days.length === 0
                ? Effect.fail(
                    new JournalValidationError({ message: dayRangeMessage }),
                  )
                : Effect.succeed(days),
            ),
          );
        });

      /** The stored note and the entry's current revision, to tell if it is stale. */
      const readNote = (date: string) =>
        sql`
          select
            agent_area.agent_note_status,
            agent_area.agent_note,
            agent_area.agent_note_model,
            agent_area.agent_note_revision,
            agent_area.agent_note_error,
            agent_area.agent_note_requested_at,
            agent_area.agent_note_generated_at,
            coalesce((select revision from entry where entry_date = ${date}), 0) as entry_revision
          from (select ${date}::date as entry_date) as day
          left join agent_area on agent_area.entry_date = day.entry_date
        `.pipe(
          Effect.flatMap(decodeNoteRows),
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.fail('The note query returned no row.')
              : Effect.succeed(rows[0]),
          ),
          Effect.mapError(journalReadError),
        );

      /**
       * Marks a note as being written and returns the request's token. The
       * previous note stays until a new one replaces it. The token travels as
       * text because a JavaScript `Date` would drop its microseconds.
       */
      const markNotePending = (
        date: string,
      ): Effect.Effect<NoteRequest, ReturnType<typeof journalWriteError>> =>
        sql`
          insert into agent_area (entry_date, agent_note_status, agent_note_requested_at)
          values (${date}, 'pending', clock_timestamp())
          on conflict (entry_date) do update set
            agent_note_status = 'pending',
            agent_note_requested_at = greatest(
              excluded.agent_note_requested_at,
              agent_area.agent_note_requested_at + interval '1 microsecond'
            ),
            agent_note_error = null
          returning agent_note_requested_at::text as request
        `.pipe(
          Effect.flatMap(decodeRequestRows),
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.fail('The note request returned no row.')
              : Effect.succeed(rows[0].request),
          ),
          Effect.mapError(journalWriteError),
        );

      /**
       * Stores a finished note, if it is still the latest request for its day.
       * A newer request supersedes an older one, so a slow generation never
       * overwrites the result of a later one. Returns whether it was stored.
       */
      const recordNote = (
        date: string,
        request: NoteRequest,
        generated: GeneratedNote,
      ) =>
        sql`
          update agent_area set
            agent_note_status = 'ready',
            agent_note = ${generated.note},
            agent_note_model = ${generated.model},
            agent_note_revision = ${generated.basedOnRevision},
            agent_note_error = null,
            agent_note_generated_at = now()
          where entry_date = ${date}
            and agent_note_status = 'pending'
            and agent_note_requested_at = ${request}::timestamptz
          returning entry_date
        `.pipe(
          Effect.map((rows) => rows.length === 1),
          Effect.mapError(journalWriteError),
        );

      /** Records why the latest request failed, keeping any previous note. */
      const recordNoteFailure = (
        date: string,
        request: NoteRequest,
        message: string,
      ) =>
        sql`
          update agent_area set
            agent_note_status = 'failed',
            agent_note_error = ${message}
          where entry_date = ${date}
            and agent_note_status = 'pending'
            and agent_note_requested_at = ${request}::timestamptz
          returning entry_date
        `.pipe(
          Effect.map((rows) => rows.length === 1),
          Effect.mapError(journalWriteError),
        );

      return {
        readWrap,
        putWrap,
        listDays,
        readNote,
        markNotePending,
        recordNote,
        recordNoteFailure,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(
    AgentAreaRepository,
    AgentAreaRepository.make,
  );
}
