/**
 * The shapes a journal entry takes, and the one place a database row is turned
 * into one.
 *
 * A row that comes back from Postgres is untrusted input like any other — the
 * column types say what the table promised, not what the driver handed back —
 * so it is decoded rather than cast. Decoding is also where the reference stops
 * being four loose columns and becomes the single optional value the rest of the
 * app passes around.
 */

import { Schema, SchemaGetter } from 'effect';

import { isJournalDate } from '../journal-day.ts';
import type { ScriptureReference } from '../scripture-reference.ts';
import {
  hasCoherentScriptureReference,
  ScriptureReferenceSchema,
  scriptureReferenceOfRow,
  scriptureReferenceRowFields,
  scriptureReferenceRowKeys,
} from './scripture-reference-row.ts';

/**
 * A calendar date, validated rather than trusted. This is what stands between a
 * URL segment and a query, so it is deliberately strict: no instants, no
 * two-digit years, and no date the calendar does not have.
 */
export const JournalDateSchema = Schema.String.check(
  Schema.makeFilter((value: string) => isJournalDate(value), {
    identifier: 'JournalDate',
    description: 'a calendar date as YYYY-MM-DD',
  }),
);

export const WordCountSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
);
export const RevisionSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
);
/** A row of `entry`, under the column names Postgres actually returns. */
const EntryRow = Schema.Struct({
  date: JournalDateSchema,
  journalMarkdown: Schema.NullOr(Schema.String),
  journalWordCount: WordCountSchema,
  journalFirstUsedAt: Schema.NullOr(Schema.Date),
  scriptureMarkdown: Schema.NullOr(Schema.String),
  scriptureWordCount: WordCountSchema,
  scriptureFirstUsedAt: Schema.NullOr(Schema.Date),
  ...scriptureReferenceRowFields,
  revision: RevisionSchema,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})
  .pipe(
    Schema.encodeKeys({
      date: 'entry_date',
      journalMarkdown: 'journal_markdown',
      journalWordCount: 'journal_word_count',
      journalFirstUsedAt: 'journal_first_used_at',
      scriptureMarkdown: 'scripture_markdown',
      scriptureWordCount: 'scripture_word_count',
      scriptureFirstUsedAt: 'scripture_first_used_at',
      ...scriptureReferenceRowKeys,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }),
  )
  .check(
    Schema.makeFilter(hasCoherentScriptureReference, {
      identifier: 'CoherentScriptureReferenceColumns',
      description:
        'scripture reference columns that form an empty, chapter, verse, or verse-range reference',
    }),
  );

export type JournalEntry = {
  readonly date: string;
  /** Empty rather than absent: a day with no evening prose has none, not null. */
  readonly journalMarkdown: string;
  readonly journalWordCount: number;
  readonly journalFirstUsedAt: Date | null;
  readonly scriptureMarkdown: string;
  readonly scriptureWordCount: number;
  readonly scriptureFirstUsedAt: Date | null;
  readonly scriptureReference?: ScriptureReference;
  /** Monotonic for this day, incremented by the same upsert that stores it. */
  readonly revision: number;
  /**
   * When the row was first stored, which is not necessarily when either
   * section first held meaningful content.
   */
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** What a decoded row has become, held to `JournalEntry` by its annotation. */
const JournalEntrySchema: Schema.Codec<JournalEntry> = Schema.Struct({
  date: Schema.String,
  journalMarkdown: Schema.String,
  journalWordCount: Schema.Number,
  journalFirstUsedAt: Schema.NullOr(Schema.Date),
  scriptureMarkdown: Schema.String,
  scriptureWordCount: Schema.Number,
  scriptureFirstUsedAt: Schema.NullOr(Schema.Date),
  scriptureReference: Schema.optionalKey(ScriptureReferenceSchema),
  revision: Schema.Number,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

/**
 * The four reference columns as the one value the app passes around. The
 * database already refuses a book without a chapter, so a book present here
 * means a chapter is too; the check is repeated rather than assumed, because
 * the alternative is trusting a constraint from inside the code that would have
 * to change if the constraint ever did.
 */
const entryOf = (row: Schema.Schema.Type<typeof EntryRow>): JournalEntry => {
  const reference = scriptureReferenceOfRow(row);
  return {
    date: row.date,
    journalMarkdown: row.journalMarkdown ?? '',
    journalWordCount: row.journalWordCount,
    journalFirstUsedAt: row.journalFirstUsedAt,
    scriptureMarkdown: row.scriptureMarkdown ?? '',
    scriptureWordCount: row.scriptureWordCount,
    scriptureFirstUsedAt: row.scriptureFirstUsedAt,
    ...(reference === undefined ? {} : { scriptureReference: reference }),
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** Decode-only: nothing writes an entry back through this shape. */
export const EntryFromRow = EntryRow.pipe(
  Schema.decodeTo(JournalEntrySchema, {
    decode: SchemaGetter.transform(entryOf),
    encode: SchemaGetter.forbiddenEncoding,
  }),
);

/** The nullable aggregate row returned by `min(entry_date)`. */
export const EarliestDateFromRow = Schema.Struct({
  date: Schema.NullOr(JournalDateSchema),
}).pipe(Schema.encodeKeys({ date: 'entry_date' }));

/**
 * What a day looks like before it has ever been written. The writing page opens
 * on one of these for any date with no row, so the editor and the counts have
 * something to render without a branch for "no entry yet".
 */
export const emptyJournalEntry = (date: string): JournalEntry => ({
  date,
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

/**
 * What the client is allowed to send. The word counts are absent on purpose:
 * the server counts the markdown it is given, so a count can never disagree
 * with the prose it counts, and an imported entry is counted by the same code
 * as a typed one.
 *
 * The reference arrives as the line the writer typed rather than as parsed
 * parts, so one parser decides what a reference is, on the server, for every
 * way an entry can reach the table.
 *
 * `baseRevision` is the row version the editor opened or last confirmed. The
 * write succeeds only while PostgreSQL still holds that version.
 */
export const EntryDraftSchema = Schema.Struct({
  date: JournalDateSchema,
  journalMarkdown: Schema.String,
  scriptureMarkdown: Schema.String,
  scriptureReference: Schema.String,
  baseRevision: RevisionSchema,
});

export type EntryDraft = Schema.Schema.Type<typeof EntryDraftSchema>;

/** The database-issued revision returned after a write is committed. */
export const SaveConfirmationSchema = Schema.Struct({
  revision: RevisionSchema,
});

export type SaveConfirmation = Schema.Schema.Type<
  typeof SaveConfirmationSchema
>;
