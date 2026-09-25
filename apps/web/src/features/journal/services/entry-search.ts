import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import { journalReadError } from '../errors/journal-errors.ts';
import { JournalDateSchema } from '../schemas/entry.ts';
import { searchTsQuery } from '../search-query.ts';

/** Every hit returns at most 1,200 UTF-8 bytes, below 64 KiB for 50 hits. */
export const searchResultByteBudget = 1200;
export const SearchEvidence = Schema.Struct({
  kind: Schema.Literal('evening', 'scripture-notes', 'passage-reference'),
  textIndex: Schema.Number,
  termIndex: Schema.Number,
  matchStart: Schema.Number,
  matchLength: Schema.Number,
});
const SearchRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  words: Schema.Number,
  texts: Schema.Array(Schema.String),
  evidence: Schema.Array(SearchEvidence),
});
export type SearchMatch = Schema.Schema.Type<typeof SearchRow>;
// Shared text is capped even for an infeasible internal query: null fails
// decoding rather than returning blank evidence or exceeding the text budget.
const decodeRows = Schema.decodeUnknown(Schema.Array(SearchRow));

export class EntrySearch extends Effect.Service<EntrySearch>()(
  'journal/EntrySearch',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const search = (
        terms: ReadonlyArray<string>,
        limit: number,
      ): Effect.Effect<
        ReadonlyArray<SearchMatch>,
        ReturnType<typeof journalReadError>
      > =>
        sql`
        with matched as materialized (
          select entry_date, journal_word_count + scripture_word_count as words
          from entry where search_vector @@ ${searchTsQuery(terms)}::tsquery
          order by entry_date desc limit ${limit}
        ), requested as (
          select value as term, (ordinality - 1)::integer as term_index
          from jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) with ordinality
        ), windows as (
          select matched.entry_date, matched.words, requested.term_index, found.*,
            count(*) over (partition by matched.entry_date) as window_count,
            sum(octet_length(substring(found.excerpt from found.match_start + 1 for 1)))
              over (partition by matched.entry_date) as minimum_bytes
          from matched cross join requested
          cross join (values ('evening'), ('scripture-notes'), ('passage-reference')) as source(kind)
          cross join lateral (
            select evidence.kind, evidence.excerpt, evidence.match_start, evidence.match_length
            from entry_search_evidence as evidence
            where evidence.entry_date = matched.entry_date and evidence.kind = source.kind
              and evidence.token collate "C" >= requested.term collate "C"
              and evidence.token collate "C" < (requested.term || chr(1114111)) collate "C"
            order by evidence.position limit 1
          ) as found
        ), budgeted as (
          select *, case when minimum_bytes <= ${searchResultByteBudget}
            then 1 + ((${searchResultByteBudget} - minimum_bytes) / (4 * window_count))::integer
            else 1 end as budget from windows
        ), positioned as (
          select *, greatest(0, match_start - budget / 4) as start_at from budgeted
        ), bounded as (
          select *, substring(excerpt from start_at + 1 for budget) as bounded_text from positioned
        ), text_windows as materialized (
          select entry_date, bounded_text,
            (row_number() over (partition by entry_date order by bounded_text) - 1)::integer as text_index
          from (select distinct entry_date, bounded_text from bounded) as unique_text
        ), text_rows as (
          select entry_date, jsonb_agg(bounded_text order by text_index) as texts,
            sum(octet_length(bounded_text)) as returned_bytes
          from text_windows group by entry_date
        )
        select bounded.entry_date, words,
          case when text_rows.returned_bytes <= ${searchResultByteBudget} then text_rows.texts else null end as texts,
          jsonb_agg(jsonb_build_object(
            'kind', kind, 'textIndex', text_windows.text_index, 'termIndex', term_index,
            'matchStart', match_start - start_at,
            'matchLength', greatest(0, least(match_length, char_length(bounded.bounded_text) - (match_start - start_at)))
          ) order by kind, term_index) as evidence
        from bounded
        join text_windows on text_windows.entry_date = bounded.entry_date and text_windows.bounded_text = bounded.bounded_text
        join text_rows on text_rows.entry_date = bounded.entry_date
        group by bounded.entry_date, words, text_rows.texts, text_rows.returned_bytes
        order by bounded.entry_date desc
      `.pipe(Effect.flatMap(decodeRows), Effect.mapError(journalReadError));
      return { search } as const;
    }),
  },
) {}
