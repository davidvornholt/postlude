import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** PostgreSQL's generated full-text search vector. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
});

/**
 * One row per journal day. A journal day runs 04:00–04:00 local time, so a
 * late-night session still belongs to the evening it closes out; the app
 * resolves the calendar date before it touches the database. The evening
 * journal prose and the optional morning scripture section share the row.
 *
 * The scripture reference is structured (book, chapter, verse range) so the
 * UI can render "Proverbs 12:5-13" and link to bibleserver.com without
 * parsing markdown. Word counts are persisted per section because the
 * archive heatmap buckets days by total words without loading entry bodies.
 *
 * The check constraints keep a partially filled reference out of the table: a
 * verse range with no book cannot be rendered or linked, so the database
 * refuses it rather than leaving the UI to guess. A book and a chapter are the
 * whole of what a reference needs — "Psalms 23" names a chapter and no verse in
 * it — so the verses are each optional above that floor, while a verse with no
 * chapter to sit in is refused. A book that is present but
 * holds no letter is refused for the same reason: it counts as filled in yet
 * renders as nothing a reader could recognise as a book. Every book name
 * carries letters, so requiring one also rejects a book built only from invisible
 * characters — a non-breaking space, a zero-width space, a soft hyphen — which
 * a whitespace-only test lets through because Postgres counts none of them as
 * `[:space:]`.
 *
 * Both timestamps carry the database clock's `now()`: `created_at` from its
 * column default, `updated_at` from the `now()` that Drizzle writes into every
 * update it issues. Neither reads an app process's clock, so the pair cannot
 * invert because a process disagrees with the database about the time.
 * `revision` starts at one and the journal upsert increments it with the row,
 * so browser ordering does not depend on those timestamps' JavaScript precision.
 */
export const entry = pgTable(
  'entry',
  {
    entryDate: date('entry_date').primaryKey(),
    journalMarkdown: text('journal_markdown'),
    journalWordCount: integer('journal_word_count').notNull().default(0),
    journalFirstUsedAt: timestamp('journal_first_used_at', {
      withTimezone: true,
    }),
    scriptureMarkdown: text('scripture_markdown'),
    scriptureWordCount: integer('scripture_word_count').notNull().default(0),
    scriptureFirstUsedAt: timestamp('scripture_first_used_at', {
      withTimezone: true,
    }),
    scriptureBook: text('scripture_book'),
    scriptureChapter: integer('scripture_chapter'),
    scriptureVerseStart: integer('scripture_verse_start'),
    scriptureVerseEnd: integer('scripture_verse_end'),
    revision: integer('revision').notNull().default(1),
    journalSearchText: text('journal_search_text').notNull(),
    scriptureSearchText: text('scripture_search_text').notNull(),
    scriptureReferenceSearchText: text(
      'scripture_reference_search_text',
    ).notNull(),
    searchTokenText: text('search_token_text').notNull(),
    searchProjectionRevision: integer('search_projection_revision').notNull(),
    searchEvidenceRevision: integer('search_evidence_revision').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    /**
     * What the search reads, kept by the database from the application-owned
     * token stream. `array_to_tsvector` accepts those tokens as lexemes instead
     * of parsing or case-folding them again. The application matches each query
     * token as a prefix. The separate visible-text projections give every match
     * a source the result row can show and highlight.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`case when search_token_text = '' then ''::tsvector else array_to_tsvector(string_to_array(search_token_text, ' ')) end`,
    ),
  },
  (table) => [
    check('entry_revision_positive', sql`${table.revision} >= 1`),
    check(
      'entry_search_evidence_current',
      sql`${table.searchEvidenceRevision} = ${table.revision}`,
    ),
    check(
      'entry_search_projection_current',
      sql`${table.searchProjectionRevision} = ${table.revision}`,
    ),
    index('entry_search_vector_index').using('gin', table.searchVector),
    check(
      'entry_journal_word_count_non_negative',
      sql`${table.journalWordCount} >= 0`,
    ),
    check(
      'entry_scripture_word_count_non_negative',
      sql`${table.scriptureWordCount} >= 0`,
    ),
    check(
      'entry_scripture_reference_complete',
      sql`num_nonnulls(${table.scriptureBook}, ${table.scriptureChapter}) in (0, 2)`,
    ),
    check(
      'entry_scripture_verse_start_needs_chapter',
      sql`${table.scriptureVerseStart} is null or ${table.scriptureChapter} is not null`,
    ),
    check(
      'entry_scripture_verse_end_after_start',
      sql`${table.scriptureVerseEnd} is null or (${table.scriptureVerseStart} is not null and ${table.scriptureVerseEnd} >= ${table.scriptureVerseStart})`,
    ),
    check(
      'entry_scripture_chapter_positive',
      sql`${table.scriptureChapter} is null or ${table.scriptureChapter} >= 1`,
    ),
    check(
      'entry_scripture_verse_start_positive',
      sql`${table.scriptureVerseStart} is null or ${table.scriptureVerseStart} >= 1`,
    ),
    check(
      'entry_scripture_book_not_blank',
      sql`${table.scriptureBook} is null or ${table.scriptureBook} ~ '[[:alpha:]]'`,
    ),
  ],
);

/** Bounded visible evidence; canonical token ordering supports indexed prefix lookups per day/source. */
export const entrySearchEvidence = pgTable(
  'entry_search_evidence',
  {
    entryDate: date('entry_date')
      .notNull()
      .references(() => entry.entryDate, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    token: text('token').notNull(),
    position: integer('position').notNull(),
    excerpt: text('excerpt').notNull(),
    matchStart: integer('match_start').notNull(),
    matchLength: integer('match_length').notNull(),
    anchorLength: integer('anchor_length').notNull(),
  },
  (table) => [
    uniqueIndex('entry_search_evidence_prefix').on(
      table.entryDate,
      table.kind,
      sql`${table.token} collate "C"`,
    ),
    check(
      'entry_search_evidence_bounded',
      sql`octet_length(${table.excerpt}) <= 960`,
    ),
    check(
      'entry_search_evidence_kind',
      sql`${table.kind} in ('evening', 'scripture-notes', 'passage-reference')`,
    ),
    check(
      'entry_search_evidence_range',
      sql`${table.matchStart} >= 0 and ${table.matchLength} >= 1 and ${table.anchorLength} >= 1 and ${table.anchorLength} <= ${table.matchLength} and ${table.matchStart} + ${table.matchLength} <= char_length(${table.excerpt})`,
    ),
  ],
);

/**
 * David's ratings for a journal day, and whether he closed it. The ratings sit
 * beside `entry` rather than on it: a rating is not a journal save, so it
 * leaves the entry's revision, its search projection, and its first save alone,
 * and a day can be rated before or without any prose.
 *
 * Every rating may be empty, and the database refuses any value outside its
 * scale. `rating_version` names the scales a row was rated on, so a later
 * change of scale can tell old rows apart. A day closes only once its energy
 * and progress are rated, which the database checks too.
 */
export const dayRating = pgTable(
  'day_rating',
  {
    entryDate: date('entry_date').primaryKey(),
    energy: text('energy'),
    progress: text('progress'),
    repeatDay: text('repeat_day'),
    ratingVersion: integer('rating_version').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'day_rating_energy_scale',
      sql`${table.energy} in ('drained', 'okay', 'fresh')`,
    ),
    check(
      'day_rating_progress_scale',
      sql`${table.progress} in ('little', 'solid', 'a_lot')`,
    ),
    check(
      'day_rating_repeat_day_scale',
      sql`${table.repeatDay} in ('yes', 'partly', 'no')`,
    ),
    check('day_rating_version_positive', sql`${table.ratingVersion} >= 1`),
    check(
      'day_rating_closed_when_rated',
      sql`${table.closedAt} is null or (${table.energy} is not null and ${table.progress} is not null)`,
    ),
  ],
);

/**
 * What agents add to a journal day, keyed by the day alone because /wrap may
 * write a day before David has written anything in it.
 *
 * Two writers own separate columns. /wrap writes the day's metrics and its
 * report through the CLI, as the `postlude_agent` role, whose grants reach only
 * those columns; re-running /wrap replaces them together. The Postlude server
 * alone writes the agent note. `agent_note_revision` is the entry revision the
 * note was written from, so a newer entry revision makes the note stale.
 *
 * The checks keep each group whole: metrics never arrive without their version
 * or their report, and a note's status always comes with what that status
 * needs to be shown. A note that is being rewritten, or whose rewrite failed,
 * keeps the previous note and the revision that note was written from.
 */
export const agentArea = pgTable(
  'agent_area',
  {
    entryDate: date('entry_date').primaryKey(),
    dayMetrics: jsonb('day_metrics'),
    metricsVersion: integer('metrics_version'),
    reportHtml: text('report_html'),
    reportModel: text('report_model'),
    reportGeneratedAt: timestamp('report_generated_at', {
      withTimezone: true,
    }),
    agentNote: text('agent_note'),
    agentNoteModel: text('agent_note_model'),
    agentNoteRevision: integer('agent_note_revision'),
    agentNoteStatus: text('agent_note_status'),
    agentNoteError: text('agent_note_error'),
    agentNoteRequestedAt: timestamp('agent_note_requested_at', {
      withTimezone: true,
    }),
    agentNoteGeneratedAt: timestamp('agent_note_generated_at', {
      withTimezone: true,
    }),
  },
  (table) => [
    check(
      'agent_area_wrap_complete',
      sql`num_nonnulls(${table.dayMetrics}, ${table.metricsVersion}, ${table.reportHtml}, ${table.reportModel}, ${table.reportGeneratedAt}) in (0, 5)`,
    ),
    check(
      'agent_area_day_metrics_object',
      sql`${table.dayMetrics} is null or jsonb_typeof(${table.dayMetrics}) = 'object'`,
    ),
    check(
      'agent_area_metrics_version_positive',
      sql`${table.metricsVersion} is null or ${table.metricsVersion} >= 1`,
    ),
    check(
      'agent_area_note_status',
      sql`${table.agentNoteStatus} in ('pending', 'ready', 'failed')`,
    ),
    check(
      'agent_area_note_revision_non_negative',
      sql`${table.agentNoteRevision} is null or ${table.agentNoteRevision} >= 0`,
    ),
    check(
      'agent_area_note_without_status',
      sql`${table.agentNoteStatus} is not null or num_nonnulls(${table.agentNote}, ${table.agentNoteModel}, ${table.agentNoteRevision}, ${table.agentNoteError}, ${table.agentNoteRequestedAt}, ${table.agentNoteGeneratedAt}) = 0`,
    ),
    check(
      'agent_area_note_pending',
      sql`${table.agentNoteStatus} is distinct from 'pending' or ${table.agentNoteRequestedAt} is not null`,
    ),
    check(
      'agent_area_note_ready',
      sql`${table.agentNoteStatus} is distinct from 'ready' or num_nonnulls(${table.agentNote}, ${table.agentNoteModel}, ${table.agentNoteRevision}, ${table.agentNoteGeneratedAt}) = 4`,
    ),
    check(
      'agent_area_note_failed',
      sql`${table.agentNoteStatus} is distinct from 'failed' or ${table.agentNoteError} is not null`,
    ),
  ],
);
