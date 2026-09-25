import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import { journalReadError } from '../errors/journal-errors.ts';
import { JournalDateSchema } from '../schemas/entry.ts';
import { searchTsQuery } from '../search-query.ts';

/** 300 Unicode characters cost at most 1,200 UTF-8 bytes per hit, below 64 KiB for 50 hits. */
export const searchResultCharacterBudget = 300;
export const SearchEvidence = Schema.Struct({
  kind: Schema.Literal('evening', 'scripture-notes', 'passage-reference'),
  text: Schema.String,
  termIndex: Schema.Number,
  matchStart: Schema.Number,
  matchLength: Schema.Number,
});
const SearchRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  words: Schema.Number,
  evidence: Schema.Array(SearchEvidence),
});
export type SearchMatch = Schema.Schema.Type<typeof SearchRow>;
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
            (${searchResultCharacterBudget} / count(*) over (partition by matched.entry_date))::integer as budget
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
        ), positioned as (
          select *, greatest(0, match_start - budget / 4) as start_at from windows
        ), bounded as (
          select *, substring(excerpt from start_at + 1 for budget) as bounded_text from positioned
        )
        select entry_date, words,
          jsonb_agg(jsonb_build_object(
            'kind', kind, 'text', bounded_text, 'termIndex', term_index,
            'matchStart', match_start - start_at,
            'matchLength', greatest(0, least(match_length, char_length(bounded_text) - (match_start - start_at)))
          ) order by kind, term_index) as evidence
        from bounded group by entry_date, words order by entry_date desc
      `.pipe(Effect.flatMap(decodeRows), Effect.mapError(journalReadError));
      return { search } as const;
    }),
  },
) {}
