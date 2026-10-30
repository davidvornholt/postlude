/**
 * What agents add to a journal day: the /wrap columns, which /wrap writes
 * through the CLI, and the agent note, which only the Postlude server writes.
 *
 * The two are separate shapes because they have separate readers. The CLI
 * reads and writes the /wrap columns only, and its database role can't read
 * the note at all.
 */

import { Schema } from 'effect';

import { DayMetricsSchema, MetricsVersionSchema } from './day-metrics.ts';
import { JournalDateSchema, RevisionSchema } from './entry.ts';

/** A report is a self-contained page; a mebibyte leaves room for inline art. */
export const reportHtmlByteLimit = 1_048_576;

const ReportHtml = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      value.trim() !== '' &&
      new TextEncoder().encode(value).byteLength <= reportHtmlByteLimit,
    {
      identifier: 'ReportHtml',
      description: `non-empty HTML of at most ${reportHtmlByteLimit} bytes`,
    },
  ),
);

const modelNameLengthLimit = 200;

const ModelName = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(modelNameLengthLimit),
);

/**
 * What `postlude agent-area put` reads on stdin. The version is given twice,
 * once inside the metrics, and the two must agree, so a report never sits next
 * to metrics it wasn't written for.
 */
export const WrapPutSchema = Schema.Struct({
  dayMetrics: DayMetricsSchema,
  metricsVersion: MetricsVersionSchema,
  reportHtml: ReportHtml,
  reportModel: ModelName,
}).check(
  Schema.makeFilter(
    (input) => input.dayMetrics.metricsVersion === input.metricsVersion,
    {
      identifier: 'MatchingMetricsVersion',
      description: 'a metricsVersion equal to dayMetrics.metricsVersion',
    },
  ),
);

export type WrapPut = Schema.Schema.Type<typeof WrapPutSchema>;

/** The /wrap columns of one day. Every field is null until /wrap writes the day. */
export const WrapAreaSchema = Schema.Struct({
  date: JournalDateSchema,
  dayMetrics: Schema.NullOr(DayMetricsSchema),
  metricsVersion: Schema.NullOr(MetricsVersionSchema),
  reportHtml: Schema.NullOr(Schema.String),
  reportModel: Schema.NullOr(Schema.String),
  reportGeneratedAt: Schema.NullOr(Schema.Date),
});

export type WrapArea = Schema.Schema.Type<typeof WrapAreaSchema>;

export const WrapAreaFromRow = WrapAreaSchema.pipe(
  Schema.encodeKeys({
    date: 'entry_date',
    dayMetrics: 'day_metrics',
    metricsVersion: 'metrics_version',
    reportHtml: 'report_html',
    reportModel: 'report_model',
    reportGeneratedAt: 'report_generated_at',
  }),
);

export const emptyWrapArea = (date: string): WrapArea => ({
  date,
  dayMetrics: null,
  metricsVersion: null,
  reportHtml: null,
  reportModel: null,
  reportGeneratedAt: null,
});

export const StoredNoteStatusSchema = Schema.Literals([
  'pending',
  'ready',
  'failed',
]);

/** The agent note columns as stored, with the entry revision beside them. */
export const StoredAgentNoteFromRow = Schema.Struct({
  status: Schema.NullOr(StoredNoteStatusSchema),
  note: Schema.NullOr(Schema.String),
  model: Schema.NullOr(Schema.String),
  basedOnRevision: Schema.NullOr(RevisionSchema),
  error: Schema.NullOr(Schema.String),
  requestedAt: Schema.NullOr(Schema.Date),
  generatedAt: Schema.NullOr(Schema.Date),
  entryRevision: RevisionSchema,
}).pipe(
  Schema.encodeKeys({
    status: 'agent_note_status',
    note: 'agent_note',
    model: 'agent_note_model',
    basedOnRevision: 'agent_note_revision',
    error: 'agent_note_error',
    requestedAt: 'agent_note_requested_at',
    generatedAt: 'agent_note_generated_at',
    entryRevision: 'entry_revision',
  }),
);

export type StoredAgentNote = Schema.Schema.Type<typeof StoredAgentNoteFromRow>;

/** How long writing one note may take before it is stopped and counts as failed. */
export const agentNoteTimeoutMinutes = 10;

/**
 * A request still pending this long after it was made was lost, most likely to
 * a restart while the note was being written: the timeout would have ended it
 * otherwise.
 */
const abandonedGraceMinutes = 5;
const abandonedAfterMinutes = agentNoteTimeoutMinutes + abandonedGraceMinutes;
const millisecondsPerMinute = 60_000;
const abandonedAfterMs = abandonedAfterMinutes * millisecondsPerMinute;

export const abandonedNoteMessage =
  'The note was interrupted before it was finished. Ask for a new one to try again.';

/**
 * What the page shows about the note.
 *
 * - `none`: no note was ever asked for.
 * - `pending`: a note is being written.
 * - `ready`: the note is current.
 * - `stale`: the note is there, but the entry changed after it was written.
 * - `failed`: the last attempt failed; `error` says why, for the page to show.
 *
 * A pending, stale, or failed note still carries the last note it had, if any,
 * with the model and revision it was written from.
 */
export const AgentNoteViewSchema = Schema.Struct({
  status: Schema.Literals(['none', 'pending', 'ready', 'stale', 'failed']),
  note: Schema.NullOr(Schema.String),
  model: Schema.NullOr(Schema.String),
  basedOnRevision: Schema.NullOr(RevisionSchema),
  entryRevision: RevisionSchema,
  error: Schema.NullOr(Schema.String),
  requestedAt: Schema.NullOr(Schema.Date),
  generatedAt: Schema.NullOr(Schema.Date),
});

export type AgentNoteView = Schema.Schema.Type<typeof AgentNoteViewSchema>;

const viewStatusOf = (
  stored: StoredAgentNote,
  now: Date,
): AgentNoteView['status'] => {
  switch (stored.status) {
    case null:
      return 'none';
    case 'pending':
      return stored.requestedAt !== null &&
        now.getTime() - stored.requestedAt.getTime() > abandonedAfterMs
        ? 'failed'
        : 'pending';
    case 'ready':
      return stored.basedOnRevision !== null &&
        stored.entryRevision > stored.basedOnRevision
        ? 'stale'
        : 'ready';
    default:
      return 'failed';
  }
};

export const agentNoteViewOf = (
  stored: StoredAgentNote,
  now: Date,
): AgentNoteView => {
  const status = viewStatusOf(stored, now);
  return {
    status,
    note: stored.note,
    model: stored.model,
    basedOnRevision: stored.basedOnRevision,
    entryRevision: stored.entryRevision,
    error:
      status === 'failed' && stored.status === 'pending'
        ? abandonedNoteMessage
        : stored.error,
    requestedAt: stored.requestedAt,
    generatedAt: stored.generatedAt,
  };
};
