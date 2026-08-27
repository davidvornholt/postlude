import { Schema } from 'effect';
import { JournalDateSchema } from './schemas/entry.ts';
import { searchExcerpts } from './search-excerpt.ts';
import type { SearchMatch } from './services/entry-search.ts';

export const searchQueryLengthLimit = 200;
export const searchUnavailableMessage =
  'Search is unavailable right now. Try again in a moment.';
export const searchAuthenticationMessage =
  'Your sign-in ended before the search finished. Sign in again to search your journal.';

export const SearchQuery = Schema.Struct({
  q: Schema.optional(
    Schema.String.pipe(Schema.maxLength(searchQueryLengthLimit)),
  ),
});

export type SearchQueryParams = Schema.Schema.Type<typeof SearchQuery>;

const NonNegativeInteger = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
);

const SearchExcerptSegment = Schema.Struct({
  text: Schema.String,
  match: Schema.Boolean,
  at: NonNegativeInteger,
});

export const SearchHitSourceKind = Schema.Literal(
  'evening',
  'passage-reference',
  'scripture-notes',
);
export type SearchHitSourceKind = Schema.Schema.Type<
  typeof SearchHitSourceKind
>;

export const SearchHitSource = Schema.Struct({
  kind: SearchHitSourceKind,
  /** One excerpt per matched term, so distant terms remain visible. */
  excerpts: Schema.Array(Schema.Array(SearchExcerptSegment)),
});
export type SearchHitSource = Schema.Schema.Type<typeof SearchHitSource>;

export const SearchHit = Schema.Struct({
  date: JournalDateSchema,
  words: NonNegativeInteger,
  /** Every visible source that contributed one or more words to the match. */
  sources: Schema.Array(SearchHitSource),
});
export type SearchHit = Schema.Schema.Type<typeof SearchHit>;

export const SearchResults = Schema.Struct({
  /** The line as typed, so the page can say what it answered. */
  query: Schema.String,
  /** Which day today is, so a result for it links to the page it lives on. */
  today: JournalDateSchema,
  /** The words it was reduced to; empty means nothing was actually asked. */
  terms: Schema.Array(Schema.String),
  hits: Schema.Array(SearchHit),
  /** There were at least this many; the page stopped counting at the limit. */
  limited: Schema.Boolean,
});
export type SearchResults = Schema.Schema.Type<typeof SearchResults>;

const hasMatch = (excerpt: SearchHitSource['excerpts'][number]): boolean =>
  excerpt.some((segment) => segment.match);

const sourceOf = (
  kind: SearchHitSourceKind,
  text: string,
  terms: ReadonlyArray<string>,
): SearchHitSource | undefined => {
  const excerpts = searchExcerpts(text, terms, {
    hardLineBoundaries: kind === 'passage-reference',
  }).excerpts.filter(hasMatch);
  return excerpts.length === 0 ? undefined : { kind, excerpts };
};

/** Keeps enough attributed evidence to explain every term in a database match. */
export const searchHitOf =
  (terms: ReadonlyArray<string>) =>
  (match: SearchMatch): SearchHit => ({
    date: match.date,
    words: match.words,
    sources: [
      sourceOf('evening', match.journalText, terms),
      sourceOf('scripture-notes', match.scriptureText, terms),
      sourceOf('passage-reference', match.scriptureReferenceText, terms),
    ].filter((source): source is SearchHitSource => source !== undefined),
  });
