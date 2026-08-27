import { Schema } from 'effect';

import { type ExcerptSegment, searchExcerpts } from './search-excerpt.ts';
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

export type SearchHit = {
  readonly date: string;
  readonly words: number;
  /** Every visible source that contributed one or more words to the match. */
  readonly sources: ReadonlyArray<SearchHitSource>;
};

export type SearchHitSourceKind =
  | 'evening'
  | 'passage-reference'
  | 'scripture-notes';

export type SearchHitSource = {
  readonly kind: SearchHitSourceKind;
  /** One excerpt per matched term, so distant terms remain visible. */
  readonly excerpts: ReadonlyArray<ReadonlyArray<ExcerptSegment>>;
};

const hasMatch = (excerpt: ReadonlyArray<ExcerptSegment>): boolean =>
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
