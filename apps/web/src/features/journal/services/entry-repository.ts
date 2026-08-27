/**
 * Every way the journal touches the database, behind one service.
 *
 * The queries are written as SQL rather than built, because what each one has to
 * say is short and saying it directly is clearer than assembling it. The column
 * names appear here and in `schemas/entry.ts` and nowhere else in the app.
 *
 * Nothing in here reads a clock. Which day it is arrives as an argument, decided
 * by `journal-day.ts` against the configured zone, so a query cannot quietly
 * disagree with the page that asked for it.
 */

import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import {
  invalidScriptureReferenceError,
  journalReadError,
  journalWriteConflictError,
  journalWriteError,
} from '../errors/journal-errors.ts';
import type { JournalDate } from '../journal-day.ts';
import {
  EarliestDateFromRow,
  type EntryDraft,
  EntryFromRow,
  type JournalEntry,
} from '../schemas/entry.ts';
import {
  type EntrySummary,
  EntrySummaryFromRow,
} from '../schemas/entry-summary.ts';
import { parseScriptureReference } from '../scripture-reference.ts';
import { searchDocumentOf } from '../search-document.ts';
import { countJournalWords } from '../word-count.ts';
import { currentMeaningfulEntry } from './entry-content-sql.ts';
import { inRepeatableReadSnapshot } from './read-snapshot.ts';

const decodeEntries = Schema.decodeUnknown(Schema.Array(EntryFromRow));
const decodeEarliestDates = Schema.decodeUnknown(
  Schema.Array(EarliestDateFromRow),
);
const decodeSummaries = Schema.decodeUnknown(Schema.Array(EntrySummaryFromRow));

export type ArchiveRead = {
  readonly earliest: JournalDate | undefined;
  readonly summaries: ReadonlyArray<EntrySummary>;
  readonly anniversaries: ReadonlyArray<JournalEntry>;
};

export type ArchiveReadRequest = {
  readonly today: JournalDate;
  readonly anniversaryMonthDay: string;
  readonly anniversaryLimit: number;
};

export class EntryRepository extends Effect.Service<EntryRepository>()(
  'journal/EntryRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const hasCurrentMeaningfulContent = currentMeaningfulEntry(sql);

      /**
       * The one day, or nothing. The caller decides what an unwritten day looks
       * like — the writing page opens a blank one — because "no row" and "a row
       * with nothing in it" are the same day to a reader and only one of them
       * exists in the table.
       */
      const read = (
        date: JournalDate,
      ): Effect.Effect<
        JournalEntry | undefined,
        ReturnType<typeof journalReadError>
      > =>
        sql`
          select *
          from entry
          where entry_date = ${date}
        `.pipe(
          Effect.flatMap(decodeEntries),
          Effect.map((entries) => entries[0]),
          Effect.mapError(journalReadError),
        );

      /**
       * Writes the day, counting the words itself. An upsert rather than a read
       * and a write, so two saves that overlap — the writer typing while the
       * last autosave is still in flight — cannot turn into an insert that
       * fails on a key that now exists.
       *
       * `updated_at` is set from the database clock, matching what Drizzle
       * writes elsewhere, so the two write paths stamp the row the same way.
       */
      const save = (
        draft: EntryDraft,
      ): Effect.Effect<
        JournalEntry,
        | ReturnType<typeof invalidScriptureReferenceError>
        | ReturnType<typeof journalWriteConflictError>
        | ReturnType<typeof journalWriteError>
      > =>
        Effect.gen(function* () {
          const enteredReference = draft.scriptureReference.trim();
          const reference = parseScriptureReference(enteredReference);
          if (enteredReference !== '' && reference === undefined) {
            return yield* Effect.fail(invalidScriptureReferenceError());
          }
          const journalWordCount = countJournalWords(draft.journalMarkdown);
          const scriptureWordCount = countJournalWords(draft.scriptureMarkdown);
          const journalUsed = journalWordCount > 0;
          const scriptureUsed =
            scriptureWordCount > 0 || reference !== undefined;
          const searchDocument = searchDocumentOf({
            journalMarkdown: draft.journalMarkdown,
            scriptureMarkdown: draft.scriptureMarkdown,
            scriptureReference: reference,
          });
          const saved = yield* sql`
          with candidate (
            entry_date,
            journal_markdown,
            journal_word_count,
            journal_first_used_at,
            scripture_markdown,
            scripture_word_count,
            scripture_first_used_at,
            scripture_book,
            scripture_chapter,
            scripture_verse_start,
            scripture_verse_end,
            journal_search_text,
            scripture_search_text,
            scripture_reference_search_text,
            search_token_text,
            search_projection_revision,
            base_revision
          ) as (values (
            ${draft.date}::date,
            ${draft.journalMarkdown}::text,
            ${journalWordCount}::integer,
            case when ${journalUsed}::boolean then now() else null end,
            ${draft.scriptureMarkdown}::text,
            ${scriptureWordCount}::integer,
            case when ${scriptureUsed}::boolean then now() else null end,
            ${reference?.book ?? null}::text,
            ${reference?.chapter ?? null}::integer,
            ${reference?.verseStart ?? null}::integer,
            ${reference?.verseEnd ?? null}::integer,
            ${searchDocument.journalText}::text,
            ${searchDocument.scriptureText}::text,
            ${searchDocument.scriptureReferenceText}::text,
            ${searchDocument.searchTokenText}::text,
            ${draft.baseRevision + 1}::integer,
            ${draft.baseRevision}::integer
          )), updated as (
            update entry set
            journal_markdown = candidate.journal_markdown,
            journal_word_count = candidate.journal_word_count,
            journal_first_used_at = coalesce(
              entry.journal_first_used_at,
              candidate.journal_first_used_at
            ),
            scripture_markdown = candidate.scripture_markdown,
            scripture_word_count = candidate.scripture_word_count,
            scripture_first_used_at = coalesce(
              entry.scripture_first_used_at,
              candidate.scripture_first_used_at
            ),
            scripture_book = candidate.scripture_book,
            scripture_chapter = candidate.scripture_chapter,
            scripture_verse_start = candidate.scripture_verse_start,
            scripture_verse_end = candidate.scripture_verse_end,
            journal_search_text = candidate.journal_search_text,
            scripture_search_text = candidate.scripture_search_text,
            scripture_reference_search_text = candidate.scripture_reference_search_text,
            search_token_text = candidate.search_token_text,
            search_projection_revision = candidate.search_projection_revision,
            revision = entry.revision + 1,
            updated_at = now()
            from candidate
            where entry.entry_date = candidate.entry_date
              and entry.revision = candidate.base_revision
            returning entry.*
          ), inserted as (
            insert into entry (
              entry_date,
              journal_markdown,
              journal_word_count,
              journal_first_used_at,
              scripture_markdown,
              scripture_word_count,
              scripture_first_used_at,
              scripture_book,
              scripture_chapter,
              scripture_verse_start,
              scripture_verse_end,
              journal_search_text,
              scripture_search_text,
              scripture_reference_search_text,
              search_token_text,
              search_projection_revision
            ) select
              entry_date,
              journal_markdown,
              journal_word_count,
              journal_first_used_at,
              scripture_markdown,
              scripture_word_count,
              scripture_first_used_at,
              scripture_book,
              scripture_chapter,
              scripture_verse_start,
              scripture_verse_end,
              journal_search_text,
              scripture_search_text,
              scripture_reference_search_text,
              search_token_text,
              search_projection_revision
            from candidate
            where base_revision = 0
            on conflict (entry_date) do nothing
            returning entry.*
          )
          select * from updated
          union all
          select * from inserted
          `.pipe(
            Effect.flatMap(decodeEntries),
            Effect.mapError(journalWriteError),
          );
          return saved[0] === undefined
            ? yield* Effect.fail(journalWriteConflictError())
            : saved[0];
        });

      /**
       * Every currently meaningful day in a range, oldest first, as the archive
       * needs them: the counts that decide a mark's weight and each section's
       * first-use stamp, which decides whether that habit counts toward its
       * streak. Cleared rows remain stored but have nothing to show here.
       *
       * The range is compared as text, which is exact because the dates are
       * zero-padded and both ends are calendar dates rather than instants.
       */
      const listBetween = (from: JournalDate, to: JournalDate) =>
        sql`
          select
            entry_date,
            journal_word_count,
            journal_first_used_at,
            scripture_word_count,
            scripture_first_used_at,
            scripture_book is not null as has_scripture_reference
          from entry
          where entry_date between ${from} and ${to}
            and ${hasCurrentMeaningfulContent}
          order by entry_date
        `.pipe(Effect.flatMap(decodeSummaries));

      /**
       * The same day of the month in earlier years, newest first. Only days
       * with prose in either section come back: "on this day" exists to hand
       * the writer something to read, and a day holding a passage reference and
       * nothing else has nothing to say here. The upper bound is exclusive, so
       * today is never its own memory.
       */
      const readAnniversaries = (
        monthDay: string,
        before: JournalDate,
        limit: number,
      ) =>
        sql`
          select *
          from entry
          where to_char(entry_date, 'MM-DD') = ${monthDay}
            and entry_date < ${before}
            and (
              journal_word_count > 0
              or scripture_word_count > 0
            )
          order by entry_date desc
          limit ${limit}
        `.pipe(Effect.flatMap(decodeEntries));

      /** The oldest day that still has something for the archive to show. */
      const earliestDate = (today: JournalDate) =>
        sql`
          select min(entry_date) as entry_date
          from entry
          where ${hasCurrentMeaningfulContent}
            and entry_date <= ${today}
        `.pipe(
          Effect.flatMap(decodeEarliestDates),
          Effect.map((rows) => rows[0]?.date ?? undefined),
        );

      const readArchive = ({
        today,
        anniversaryMonthDay,
        anniversaryLimit,
      }: ArchiveReadRequest): Effect.Effect<
        ArchiveRead,
        ReturnType<typeof journalReadError>
      > =>
        inRepeatableReadSnapshot(
          sql,
          Effect.gen(function* () {
            const earliest = yield* earliestDate(today);
            const summaries =
              earliest === undefined ? [] : yield* listBetween(earliest, today);
            const anniversaries = yield* readAnniversaries(
              anniversaryMonthDay,
              today,
              anniversaryLimit,
            );
            return { earliest, summaries, anniversaries };
          }),
        ).pipe(Effect.mapError(journalReadError));

      return {
        read,
        save,
        readArchive,
      } as const;
    }),
  },
) {}
