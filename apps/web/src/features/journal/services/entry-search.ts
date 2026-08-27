/**
 * Finding a day by what is written on it.
 *
 * This is its own service rather than another method on `EntryRepository`. The
 * repository reads and writes the day: a row keyed by a date, with the columns
 * the writing page and the archive need. Search reads an index instead, and owns
 * a small query language of its own — what a typed line means, which days count
 * as answering it, and in what order they come back. The two touch the same
 * table and answer different questions about it, and each owns the projection
 * its own answer needs.
 *
 * The index is a stored `tsvector` the database keeps for every row, so it can
 * never fall behind the words it describes; `packages/db/src/schema.ts` is where
 * it is declared and binds it to the app-owned token stream.
 *
 * Results come back newest first rather than by relevance score. A journal is
 * read in time: two days that both hold the word are told apart by which was
 * more recent, not by which repeated it more often.
 */

import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import { journalReadError } from '../errors/journal-errors.ts';
import { JournalDateSchema } from '../schemas/entry.ts';

/**
 * A matched day, with the visible projections the excerpt is cut from. The
 * stored search vector is deliberately not selected: it holds the canonical
 * lexemes derived from these raw sources, while a result needs the exact text
 * the Markdown reader showed.
 */
const SearchRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  journalText: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('journal_search_text'),
  ),
  scriptureText: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('scripture_search_text'),
  ),
  scriptureReferenceText: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('scripture_reference_search_text'),
  ),
  words: Schema.propertySignature(Schema.Number).pipe(Schema.fromKey('words')),
});

export type SearchMatch = {
  readonly date: string;
  readonly journalText: string;
  readonly scriptureText: string;
  readonly scriptureReferenceText: string;
  readonly words: number;
};

const decodeRows = Schema.decodeUnknown(Schema.Array(SearchRow));

const matchOf = (row: Schema.Schema.Type<typeof SearchRow>): SearchMatch => ({
  date: row.date,
  journalText: row.journalText,
  scriptureText: row.scriptureText,
  scriptureReferenceText: row.scriptureReferenceText,
  words: row.words,
});

export class EntrySearch extends Effect.Service<EntrySearch>()(
  'journal/EntrySearch',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      /**
       * The days matching a `tsquery`, newest first.
       *
       * The query arrives as the application-owned canonical tokens joined by
       * tsquery operators. Casting it preserves those lexemes instead of asking
       * Postgres to parse and case-fold the source text a second way. Each token
       * contains only letters and digits, so none can become query syntax.
       */
      const search = (
        tsQuery: string,
        limit: number,
      ): Effect.Effect<
        ReadonlyArray<SearchMatch>,
        ReturnType<typeof journalReadError>
      > =>
        sql`
          select
            entry_date,
            journal_search_text,
            scripture_search_text,
            scripture_reference_search_text,
            journal_word_count + scripture_word_count as words
          from entry
          where search_vector @@ ${tsQuery}::tsquery
          order by entry_date desc
          limit ${limit}
        `.pipe(
          Effect.flatMap(decodeRows),
          Effect.map((rows) => rows.map(matchOf)),
          Effect.mapError(journalReadError),
        );

      return { search } as const;
    }),
  },
) {}
