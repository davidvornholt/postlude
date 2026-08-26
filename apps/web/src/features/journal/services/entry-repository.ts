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
import { countJournalWords } from '../word-count.ts';
import { inArchiveSnapshot } from './archive-snapshot.ts';

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
      const hasCurrentMeaningfulContent = sql.or([
        sql`journal_word_count > 0`,
        sql`scripture_word_count > 0`,
        sql`scripture_book is not null`,
      ]);

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
          return yield* sql`
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
            scripture_verse_end
          ) values (
            ${draft.date},
            ${draft.journalMarkdown},
            ${journalWordCount},
            case when ${journalUsed} then now() else null end,
            ${draft.scriptureMarkdown},
            ${scriptureWordCount},
            case when ${scriptureUsed} then now() else null end,
            ${reference?.book ?? null},
            ${reference?.chapter ?? null},
            ${reference?.verseStart ?? null},
            ${reference?.verseEnd ?? null}
          )
          on conflict (entry_date) do update set
            journal_markdown = excluded.journal_markdown,
            journal_word_count = excluded.journal_word_count,
            journal_first_used_at = coalesce(
              entry.journal_first_used_at,
              excluded.journal_first_used_at
            ),
            scripture_markdown = excluded.scripture_markdown,
            scripture_word_count = excluded.scripture_word_count,
            scripture_first_used_at = coalesce(
              entry.scripture_first_used_at,
              excluded.scripture_first_used_at
            ),
            scripture_book = excluded.scripture_book,
            scripture_chapter = excluded.scripture_chapter,
            scripture_verse_start = excluded.scripture_verse_start,
            scripture_verse_end = excluded.scripture_verse_end,
            updated_at = now()
          returning *
          `.pipe(
            Effect.flatMap(decodeEntries),
            Effect.flatMap((entries) =>
              entries[0] === undefined
                ? Effect.fail(new Error('The saved entry did not come back.'))
                : Effect.succeed(entries[0]),
            ),
            Effect.mapError(journalWriteError),
          );
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
       * with evening prose come back: "on this day" exists to hand the writer
       * something to read, and a day holding a passage reference and nothing
       * else has nothing to say here. The upper bound is exclusive, so today is
       * never its own memory.
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
            and journal_word_count > 0
          order by entry_date desc
          limit ${limit}
        `.pipe(Effect.flatMap(decodeEntries));

      /** The oldest day that still has something for the archive to show. */
      const earliestDate = () =>
        sql`
          select min(entry_date) as entry_date
          from entry
          where ${hasCurrentMeaningfulContent}
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
        inArchiveSnapshot(
          sql,
          Effect.gen(function* () {
            const earliest = yield* earliestDate();
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
