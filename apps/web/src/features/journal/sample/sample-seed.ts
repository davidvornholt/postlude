/**
 * Stores a sample journal in a database that holds no journal yet, all in one
 * transaction, so a preview starts either with the whole sample or untouched.
 *
 * Entries go through `EntryRepository.save`, the path the writing page takes,
 * so their word counts, search columns and search evidence are exactly what
 * the app would have stored for the same text. Saving stamps the database
 * clock, so the times the sample says each day was written are set afterwards;
 * the streaks and Insights read those. Ratings and what agents added are
 * inserted with their times as they are, and a day log gets the search
 * columns and evidence `agent-area put` would have stored for it.
 */

import { Effect } from 'effect';
import { SqlClient } from 'effect/sql';

import { currentRatingVersion } from '../schemas/day-rating.ts';
import { searchTokenText } from '../search-query.ts';
import { dayLogSearchEvidence } from '../search-stored-evidence.ts';
import { EntryRepository } from '../services/entry-repository.ts';
import { replaceDayLogEvidence } from '../services/search-evidence-write.ts';
import { agentNoteModel } from './sample-agent-note.ts';
import type { SampleDay, SampleEntry } from './sample-day.ts';
import { sampleDayLog } from './sample-day-log.ts';
import type { SamplePlan } from './sample-plan.ts';
import { sampleReportHtml } from './sample-report.ts';
import { reportModel } from './sample-wrap.ts';

export type SeedOutcome =
  | { readonly seeded: false }
  | {
      readonly seeded: true;
      readonly today: string;
      readonly entries: number;
      readonly ratings: number;
      readonly agentAreas: number;
    };

const withEntry = (
  days: ReadonlyArray<SampleDay>,
): ReadonlyArray<SampleDay & { readonly entry: SampleEntry }> =>
  days.flatMap((day) =>
    day.entry === undefined ? [] : [{ ...day, entry: day.entry }],
  );

const iso = (instant: Date | null): string | null =>
  instant === null ? null : instant.toISOString();

const createdAtOf = (entry: SampleEntry): Date =>
  new Date(
    Math.min(
      entry.updatedAt.getTime(),
      ...[entry.scriptureFirstUsedAt, entry.journalFirstUsedAt].flatMap(
        (instant) => (instant === null ? [] : [instant.getTime()]),
      ),
    ),
  );

const saveEntries = (
  entries: EntryRepository['Service'],
  days: ReadonlyArray<SampleDay & { readonly entry: SampleEntry }>,
) =>
  Effect.forEach(
    days,
    ({ date, entry }) =>
      Effect.gen(function* () {
        const draft = {
          date,
          journalMarkdown: entry.journalMarkdown,
          scriptureMarkdown: entry.scriptureMarkdown,
          scriptureReference: entry.scriptureReference,
        };
        const first = yield* entries.save({ ...draft, baseRevision: 0 });
        if (entry.laterJournalMarkdown !== undefined) {
          yield* entries.save({
            ...draft,
            journalMarkdown: entry.laterJournalMarkdown,
            baseRevision: first.revision,
          });
        }
      }),
    { discard: true },
  );

/**
 * Sets when each entry was created, first used and last changed. A section the
 * save left unused stays unused, whatever the sample says.
 */
const backdateEntries = (
  sql: SqlClient.SqlClient,
  days: ReadonlyArray<SampleDay & { readonly entry: SampleEntry }>,
) => {
  const times = days.map(({ date, entry }) => ({
    date,
    createdAt: iso(createdAtOf(entry)),
    journalFirstUsedAt: iso(entry.journalFirstUsedAt),
    scriptureFirstUsedAt: iso(entry.scriptureFirstUsedAt),
    updatedAt: iso(entry.updatedAt),
  }));
  return sql`
    update entry set
      created_at = sample."createdAt",
      journal_first_used_at = case
        when entry.journal_first_used_at is null then null
        else coalesce(sample."journalFirstUsedAt", sample."createdAt")
      end,
      scripture_first_used_at = case
        when entry.scripture_first_used_at is null then null
        else coalesce(sample."scriptureFirstUsedAt", sample."createdAt")
      end,
      updated_at = sample."updatedAt"
    from jsonb_to_recordset(${JSON.stringify(times)}::jsonb)
      as sample(
        date date,
        "createdAt" timestamptz,
        "journalFirstUsedAt" timestamptz,
        "scriptureFirstUsedAt" timestamptz,
        "updatedAt" timestamptz
      )
    where entry.entry_date = sample.date
  `;
};

const insertRatings = (
  sql: SqlClient.SqlClient,
  days: ReadonlyArray<SampleDay>,
) => {
  const ratings = days.flatMap(({ date, rating }) =>
    rating === undefined
      ? []
      : [
          {
            date,
            energy: rating.energy,
            progress: rating.progress,
            repeatDay: rating.repeatDay,
            closedAt: iso(rating.closedAt),
            updatedAt: iso(rating.updatedAt),
          },
        ],
  );
  return sql`
    insert into day_rating (
      entry_date, energy, progress, repeat_day, rating_version, closed_at, updated_at
    )
    select
      date, energy, progress, "repeatDay", ${currentRatingVersion}, "closedAt", "updatedAt"
    from jsonb_to_recordset(${JSON.stringify(ratings)}::jsonb)
      as rating(
        date date,
        energy text,
        progress text,
        "repeatDay" text,
        "closedAt" timestamptz,
        "updatedAt" timestamptz
      )
  `.pipe(Effect.as(ratings.length));
};

const dayLogOf = ({ wrap }: SampleDay) =>
  wrap === undefined ? null : sampleDayLog(wrap.dayMetrics);

const agentAreaOf = (day: SampleDay) => {
  const { date, wrap, note } = day;
  const dayLog = dayLogOf(day);
  return {
    date,
    dayMetrics: wrap?.dayMetrics ?? null,
    metricsVersion: wrap?.dayMetrics.metricsVersion ?? null,
    reportHtml: wrap === undefined ? null : sampleReportHtml,
    reportModel: wrap === undefined ? null : reportModel,
    reportGeneratedAt: iso(wrap?.generatedAt ?? null),
    dayLog,
    dayLogSearchTokenText: dayLog === null ? null : searchTokenText(dayLog),
    noteStatus: note?.status ?? null,
    note: note?.status === 'ready' ? note.note : null,
    noteModel: note?.status === 'ready' ? agentNoteModel : null,
    noteRevision: note?.status === 'ready' ? note.basedOnRevision : null,
    noteError: note?.status === 'failed' ? note.error : null,
    noteRequestedAt: iso(note?.requestedAt ?? null),
    noteGeneratedAt: iso(note?.status === 'ready' ? note.generatedAt : null),
  };
};

const insertAgentAreas = (
  sql: SqlClient.SqlClient,
  days: ReadonlyArray<SampleDay>,
) => {
  const areas = days
    .filter((day) => day.wrap !== undefined || day.note !== undefined)
    .map(agentAreaOf);
  return sql`
    insert into agent_area (
      entry_date, day_metrics, metrics_version, report_html, report_model,
      report_generated_at, day_log, day_log_search_token_text,
      agent_note_status, agent_note, agent_note_model, agent_note_revision,
      agent_note_error, agent_note_requested_at, agent_note_generated_at
    )
    select
      date, "dayMetrics", "metricsVersion", "reportHtml", "reportModel",
      "reportGeneratedAt", "dayLog", "dayLogSearchTokenText", "noteStatus",
      note, "noteModel", "noteRevision", "noteError", "noteRequestedAt",
      "noteGeneratedAt"
    from jsonb_to_recordset(${JSON.stringify(areas)}::jsonb)
      as area(
        date date,
        "dayMetrics" jsonb,
        "metricsVersion" integer,
        "reportHtml" text,
        "reportModel" text,
        "reportGeneratedAt" timestamptz,
        "dayLog" text,
        "dayLogSearchTokenText" text,
        "noteStatus" text,
        note text,
        "noteModel" text,
        "noteRevision" integer,
        "noteError" text,
        "noteRequestedAt" timestamptz,
        "noteGeneratedAt" timestamptz
      )
  `.pipe(Effect.as(areas.length));
};

const insertDayLogEvidence = (
  sql: SqlClient.SqlClient,
  days: ReadonlyArray<SampleDay>,
) =>
  Effect.forEach(
    days,
    (day) => {
      const dayLog = dayLogOf(day);
      return dayLog === null
        ? Effect.void
        : replaceDayLogEvidence(sql, day.date, dayLogSearchEvidence(dayLog));
    },
    { discard: true },
  );

/**
 * Whether any journal day is stored. Sign-in rows don't count: the account
 * that signs in to a preview finds the journal whoever created it.
 */
const holdsJournal = (sql: SqlClient.SqlClient) =>
  sql<{ readonly held: boolean }>`
    select
      exists (select from entry)
      or exists (select from day_rating)
      or exists (select from agent_area) as held
  `.pipe(Effect.map((rows) => rows[0]?.held === true));

/**
 * Stores `plan` unless a journal is already there. The tables stay locked
 * against writes until the transaction ends, so the app can't write a day
 * between the check and the sample.
 */
export const seedSampleJournal = (plan: SamplePlan) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const entries = yield* EntryRepository;
    return yield* Effect.gen(function* () {
      yield* sql`lock table entry, day_rating, agent_area in share row exclusive mode`;
      if (yield* holdsJournal(sql)) {
        return { seeded: false } as const;
      }
      const written = withEntry(plan.days);
      yield* saveEntries(entries, written);
      yield* backdateEntries(sql, written);
      const ratings = yield* insertRatings(sql, plan.days);
      const agentAreas = yield* insertAgentAreas(sql, plan.days);
      yield* insertDayLogEvidence(sql, plan.days);
      return {
        seeded: true,
        today: plan.today,
        entries: written.length,
        ratings,
        agentAreas,
      } as const;
    }).pipe(sql.withTransaction);
  });
