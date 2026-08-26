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
  type EntrySummary,
  EntrySummaryFromRow,
  type JournalEntry,
} from '../schemas/entry.ts';
import { parseScriptureReference } from '../scripture-reference.ts';
import { countJournalWords } from '../word-count.ts';

const decodeEntries = Schema.decodeUnknown(Schema.Array(EntryFromRow));
const decodeEarliestDates = Schema.decodeUnknown(
  Schema.Array(EarliestDateFromRow),
);
const decodeSummaries = Schema.decodeUnknown(Schema.Array(EntrySummaryFromRow));

export class EntryRepository extends Effect.Service<EntryRepository>()(
  'journal/EntryRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

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
          return yield* sql`
          insert into entry (
            entry_date,
            journal_markdown,
            journal_word_count,
            scripture_markdown,
            scripture_word_count,
            scripture_book,
            scripture_chapter,
            scripture_verse_start,
            scripture_verse_end
          ) values (
            ${draft.date},
            ${draft.journalMarkdown},
            ${countJournalWords(draft.journalMarkdown)},
            ${draft.scriptureMarkdown},
            ${countJournalWords(draft.scriptureMarkdown)},
            ${reference?.book ?? null},
            ${reference?.chapter ?? null},
            ${reference?.verseStart ?? null},
            ${reference?.verseEnd ?? null}
          )
          on conflict (entry_date) do update set
            journal_markdown = excluded.journal_markdown,
            journal_word_count = excluded.journal_word_count,
            scripture_markdown = excluded.scripture_markdown,
            scripture_word_count = excluded.scripture_word_count,
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
       * Every written day in a range, oldest first, as the archive needs them:
       * the counts that decide a mark's weight and the creation stamp that
       * decides whether the day counts toward a streak.
       *
       * The range is compared as text, which is exact because the dates are
       * zero-padded and both ends are calendar dates rather than instants.
       */
      const listBetween = (
        from: JournalDate,
        to: JournalDate,
      ): Effect.Effect<
        ReadonlyArray<EntrySummary>,
        ReturnType<typeof journalReadError>
      > =>
        sql`
          select
            entry_date,
            journal_word_count,
            scripture_word_count,
            scripture_book is not null as has_scripture_reference,
            created_at
          from entry
          where entry_date between ${from} and ${to}
          order by entry_date
        `.pipe(
          Effect.flatMap(decodeSummaries),
          Effect.mapError(journalReadError),
        );

      /** The first day ever written, which is where the archive starts. */
      const earliestDate = (): Effect.Effect<
        JournalDate | undefined,
        ReturnType<typeof journalReadError>
      > =>
        sql`
          select min(entry_date) as entry_date
          from entry
        `.pipe(
          Effect.flatMap(decodeEarliestDates),
          Effect.map((rows) => rows[0]?.date ?? undefined),
          Effect.mapError(journalReadError),
        );

      return { read, save, listBetween, earliestDate } as const;
    }),
  },
) {}
