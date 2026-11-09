import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { journalReadError } from '../errors/journal-errors.ts';
import { JournalDateSchema } from '../schemas/entry.ts';
import {
  excerptCharacters,
  leadingContext,
} from '../search-stored-evidence.ts';

/** Every hit returns at most 1,200 UTF-8 bytes, below 64 KiB for 50 hits. */
export const searchResultByteBudget = 1200;
export const SearchEvidence = Schema.Struct({
  kind: Schema.Literals([
    'evening',
    'scripture-notes',
    'passage-reference',
    'day-report',
  ]),
  textIndex: Schema.Number,
  termIndex: Schema.Number,
  matchStart: Schema.Number,
  matchLength: Schema.Number,
});
const SearchRow = Schema.Struct({
  date: JournalDateSchema,
  words: Schema.Number,
  texts: Schema.Array(Schema.String),
  evidence: Schema.Array(SearchEvidence),
}).pipe(Schema.encodeKeys({ date: 'entry_date' }));
export type SearchMatch = Schema.Schema.Type<typeof SearchRow>;
// Shared text is capped even for an infeasible internal query: null fails
// decoding rather than returning blank evidence or exceeding the text budget.
const decodeRows = Schema.decodeUnknownEffect(Schema.Array(SearchRow));

/**
 * Where a search looks. David's own writing always; the report /wrap stored
 * for the day only when asked, since it is the agent's text and not his.
 */
export type SearchScope = { readonly dayReport: boolean };

/** David's writing alone: what the CLI's search returns. */
export const writingOnly: SearchScope = { dayReport: false };

/**
 * Finds the days that hold every term, each matched as a prefix. When the scope
 * includes the report, a term may match David's writing or the day's report,
 * so one day can hold a word in each. Days whose writing holds every term come
 * first, so the words every report repeats, such as its headings, can't push
 * them out, and a term David wrote that day is never shown from the report.
 *
 * Without the report the query names no column of `agent_area`, so the CLI's
 * role, which can't read the report's text, never needs more.
 */
export class EntrySearch extends Context.Service<EntrySearch>()(
  'journal/EntrySearch',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const search = (
        terms: ReadonlyArray<string>,
        limit: number,
        scope: SearchScope = writingOnly,
      ): Effect.Effect<
        ReadonlyArray<SearchMatch>,
        ReturnType<typeof journalReadError>
      > => {
        const reportDays = scope.dayReport
          ? sql`
            union all
            select entry_date, false from agent_area
            where report_search_vector @@ (requested.term || ':*')::tsquery`
          : sql``;
        const reportSource = scope.dayReport ? sql`, ('day-report')` : sql``;
        // The word is found in the report's text by the fold its search vector
        // uses, which keeps every character in place, and cut out the way an
        // entry's stored evidence is.
        const reportEvidence = scope.dayReport
          ? sql`
            union all
            select 'day-report',
              substring(report_text from greatest(0, match_at - ${leadingContext}) + 1 for ${excerptCharacters}),
              least(match_at, ${leadingContext}), char_length(word), 1
            from (
              select report_text,
                regexp_instr(folded, pattern, 1, 1, 0, '', 1) - 1 as match_at,
                regexp_substr(folded, pattern, 1, 1, '', 1) as word
              from agent_area,
                translate(lower(report_text collate "pg_c_utf8"), 'ς', 'σ') as folded,
                concat('(?:^|[^[:alnum:]])(', requested.term, '[[:alnum:]]*)') as pattern
              where source.kind = 'day-report' and not term_days.written
                and agent_area.entry_date = matched.entry_date
            ) as report
            where match_at >= 0`
          : sql``;
        return sql`
        with requested as (
          select value as term, (ordinality - 1)::integer as term_index
          from jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) with ordinality
        ), term_days as (
          select requested.term_index, day.entry_date, bool_or(day.written) as written
          from requested cross join lateral (
            select entry_date, true as written from entry
            where search_vector @@ (requested.term || ':*')::tsquery
            ${reportDays}
          ) as day
          group by requested.term_index, day.entry_date
        ), matched_days as (
          select entry_date, bool_and(written) as written from term_days
          group by entry_date
          having count(*) = (select count(*) from requested)
        ), matched as materialized (
          select matched_days.entry_date, matched_days.written,
            coalesce(entry.journal_word_count + entry.scripture_word_count, 0) as words
          from matched_days left join entry on entry.entry_date = matched_days.entry_date
          order by matched_days.written desc, matched_days.entry_date desc limit ${limit}
        ), windows as (
          select matched.entry_date, matched.written, matched.words, requested.term_index, found.*,
            count(*) over (partition by matched.entry_date) as window_count,
            sum(octet_length(substring(found.excerpt from found.match_start + 1 for found.anchor_length)))
              over (partition by matched.entry_date) as minimum_bytes
          from matched cross join requested
          join term_days on term_days.entry_date = matched.entry_date and term_days.term_index = requested.term_index
          cross join (values ('evening'), ('scripture-notes'), ('passage-reference')${reportSource}) as source(kind)
          cross join lateral (
            (select evidence.kind, evidence.excerpt, evidence.match_start, evidence.match_length, evidence.anchor_length
            from entry_search_evidence as evidence
            where evidence.entry_date = matched.entry_date and evidence.kind = source.kind
              and evidence.token collate "C" >= requested.term collate "C"
              and evidence.token collate "C" < (requested.term || chr(1114111)) collate "C"
            order by evidence.position limit 1)
            ${reportEvidence}
          ) as found
        ), budgeted as (
          select *, case when minimum_bytes <= ${searchResultByteBudget}
            then anchor_length + ((${searchResultByteBudget} - minimum_bytes) / (4 * window_count))::integer
            else anchor_length end as budget from windows
        ), positioned as (
          select *, greatest(0, match_start - (budget - anchor_length) / 4) as start_at from budgeted
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
        select bounded.entry_date, written, words,
          case when text_rows.returned_bytes <= ${searchResultByteBudget} then text_rows.texts else null end as texts,
          jsonb_agg(jsonb_build_object(
            'kind', kind, 'textIndex', text_windows.text_index, 'termIndex', term_index,
            'matchStart', match_start - start_at,
            'matchLength', greatest(0, least(match_length, char_length(bounded.bounded_text) - (match_start - start_at)))
          ) order by kind, term_index) as evidence
        from bounded
        join text_windows on text_windows.entry_date = bounded.entry_date and text_windows.bounded_text = bounded.bounded_text
        join text_rows on text_rows.entry_date = bounded.entry_date
        group by bounded.entry_date, written, words, text_rows.texts, text_rows.returned_bytes
        order by written desc, bounded.entry_date desc
      `.pipe(Effect.flatMap(decodeRows), Effect.mapError(journalReadError));
      };
      return { search } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(EntrySearch, EntrySearch.make);
}
