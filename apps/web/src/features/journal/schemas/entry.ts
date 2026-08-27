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

import { Schema } from 'effect';

import { isJournalDate } from '../journal-day.ts';
import type { ScriptureReference } from '../scripture-reference.ts';

/**
 * A calendar date, validated rather than trusted. This is what stands between a
 * URL segment and a query, so it is deliberately strict: no instants, no
 * two-digit years, and no date the calendar does not have.
 */
export const JournalDateSchema = Schema.String.pipe(
  Schema.filter((value) => isJournalDate(value), {
    identifier: 'JournalDate',
    description: 'a calendar date as YYYY-MM-DD',
  }),
);

const WordCount = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
);
const Revision = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
);
const VerseNumber = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0));
const containsLetter = /\p{L}/u;

/** A row of `entry`, under the column names Postgres actually returns. */
const EntryRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  journalMarkdown: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('journal_markdown'),
  ),
  journalWordCount: Schema.propertySignature(WordCount).pipe(
    Schema.fromKey('journal_word_count'),
  ),
  scriptureMarkdown: Schema.propertySignature(
    Schema.NullOr(Schema.String),
  ).pipe(Schema.fromKey('scripture_markdown')),
  scriptureWordCount: Schema.propertySignature(WordCount).pipe(
    Schema.fromKey('scripture_word_count'),
  ),
  scriptureBook: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('scripture_book'),
  ),
  scriptureChapter: Schema.propertySignature(Schema.NullOr(VerseNumber)).pipe(
    Schema.fromKey('scripture_chapter'),
  ),
  scriptureVerseStart: Schema.propertySignature(
    Schema.NullOr(VerseNumber),
  ).pipe(Schema.fromKey('scripture_verse_start')),
  scriptureVerseEnd: Schema.propertySignature(Schema.NullOr(VerseNumber)).pipe(
    Schema.fromKey('scripture_verse_end'),
  ),
  revision: Schema.propertySignature(Revision).pipe(Schema.fromKey('revision')),
  createdAt: Schema.propertySignature(Schema.ValidDateFromSelf).pipe(
    Schema.fromKey('created_at'),
  ),
  updatedAt: Schema.propertySignature(Schema.ValidDateFromSelf).pipe(
    Schema.fromKey('updated_at'),
  ),
}).pipe(
  Schema.filter(
    (row) =>
      (row.scriptureBook === null) === (row.scriptureChapter === null) &&
      (row.scriptureVerseStart === null || row.scriptureChapter !== null) &&
      (row.scriptureVerseEnd === null ||
        (row.scriptureVerseStart !== null &&
          row.scriptureVerseEnd >= row.scriptureVerseStart)) &&
      (row.scriptureBook === null || containsLetter.test(row.scriptureBook)),
    {
      identifier: 'CoherentScriptureReferenceColumns',
      description:
        'scripture reference columns that form an empty, chapter, verse, or verse-range reference',
    },
  ),
);

export type JournalEntry = {
  readonly date: string;
  /** Empty rather than absent: a day with no evening prose has none, not null. */
  readonly journalMarkdown: string;
  readonly journalWordCount: number;
  readonly scriptureMarkdown: string;
  readonly scriptureWordCount: number;
  readonly scriptureReference?: ScriptureReference;
  /** Monotonic for this day, incremented by the same upsert that stores it. */
  readonly revision: number;
  /**
   * When the row was first written, which is not the day it is about. The
   * streaks read this to tell a day written on the day from one filled in
   * later.
   */
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * The four reference columns as the one value the app passes around. The
 * database already refuses a book without a chapter, so a book present here
 * means a chapter is too; the check is repeated rather than assumed, because
 * the alternative is trusting a constraint from inside the code that would have
 * to change if the constraint ever did.
 */
const referenceOf = (
  row: Schema.Schema.Type<typeof EntryRow>,
): ScriptureReference | undefined => {
  if (row.scriptureBook === null || row.scriptureChapter === null) {
    return undefined;
  }
  const chapter = row.scriptureChapter;
  if (row.scriptureVerseStart === null) {
    return { book: row.scriptureBook, chapter };
  }
  const verseStart = row.scriptureVerseStart;
  return row.scriptureVerseEnd === null
    ? { book: row.scriptureBook, chapter, verseStart }
    : {
        book: row.scriptureBook,
        chapter,
        verseStart,
        verseEnd: row.scriptureVerseEnd,
      };
};

const entryOf = (row: Schema.Schema.Type<typeof EntryRow>): JournalEntry => {
  const reference = referenceOf(row);
  return {
    date: row.date,
    journalMarkdown: row.journalMarkdown ?? '',
    journalWordCount: row.journalWordCount,
    scriptureMarkdown: row.scriptureMarkdown ?? '',
    scriptureWordCount: row.scriptureWordCount,
    ...(reference === undefined ? {} : { scriptureReference: reference }),
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const EntryFromRow = Schema.transform(
  EntryRow,
  Schema.Any as Schema.Schema<JournalEntry>,
  { strict: false, decode: entryOf, encode: (entry) => entry },
);

/** The nullable aggregate row returned by `min(entry_date)`. */
export const EarliestDateFromRow = Schema.Struct({
  date: Schema.propertySignature(Schema.NullOr(JournalDateSchema)).pipe(
    Schema.fromKey('entry_date'),
  ),
});

/**
 * What a day looks like before it has ever been written. The writing page opens
 * on one of these for any date with no row, so the editor and the counts have
 * something to render without a branch for "no entry yet".
 */
export const emptyJournalEntry = (date: string): JournalEntry => ({
  date,
  journalMarkdown: '',
  journalWordCount: 0,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
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
  baseRevision: Revision,
});

export type EntryDraft = Schema.Schema.Type<typeof EntryDraftSchema>;

/** The database-issued revision returned after a write is committed. */
export const SaveConfirmationSchema = Schema.Struct({
  revision: Revision,
});

export type SaveConfirmation = Schema.Schema.Type<
  typeof SaveConfirmationSchema
>;

/**
 * One day as the archive needs it: enough to place a mark on the heatmap and to
 * decide a streak, and nothing else. The entry bodies are deliberately not here
 * — a year of them is a lot of prose to send in order to draw 365 squares.
 */
export const EntrySummaryFromRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  journalWordCount: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('journal_word_count'),
  ),
  scriptureWordCount: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('scripture_word_count'),
  ),
  hasScriptureReference: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.fromKey('has_scripture_reference'),
  ),
  createdAt: Schema.propertySignature(Schema.ValidDateFromSelf).pipe(
    Schema.fromKey('created_at'),
  ),
});

export type EntrySummary = Schema.Schema.Type<typeof EntrySummaryFromRow>;
