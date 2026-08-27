import { Schema } from 'effect';

import { type ExcerptSegment, searchExcerpt } from './search-query.ts';
import type { SearchMatch } from './services/entry-search.ts';

export const searchQueryLengthLimit = 200;
export const searchUnavailableMessage =
  'Search is unavailable right now. Try again in a moment.';

export const SearchQuery = Schema.Struct({
  q: Schema.optional(
    Schema.String.pipe(Schema.maxLength(searchQueryLengthLimit)),
  ),
});

export type SearchQueryParams = Schema.Schema.Type<typeof SearchQuery>;

export type SearchHit = {
  readonly date: string;
  readonly words: number;
  /** Where the passage is what matched, so the excerpt is not the evening's. */
  readonly fromScripture: boolean;
  readonly excerpt: ReadonlyArray<ExcerptSegment>;
};

const matchedSegments = (excerpt: ReadonlyArray<ExcerptSegment>): number =>
  excerpt.filter((segment) => segment.match).length;

const strongestExcerpt = (
  texts: ReadonlyArray<string>,
  terms: ReadonlyArray<string>,
): ReadonlyArray<ExcerptSegment> =>
  texts
    .map((text) => searchExcerpt(text, terms))
    .reduce<ReadonlyArray<ExcerptSegment>>(
      (strongest, candidate) =>
        matchedSegments(candidate) > matchedSegments(strongest)
          ? candidate
          : strongest,
      [],
    );

/** Selects the source that visibly explains the database match most strongly. */
export const searchHitOf =
  (terms: ReadonlyArray<string>) =>
  (match: SearchMatch): SearchHit => {
    const evening = searchExcerpt(match.journalText, terms);
    const morning = strongestExcerpt(
      [match.scriptureText, ...match.scriptureReferenceText.split('\n')],
      terms,
    );
    const fromScripture = matchedSegments(morning) > matchedSegments(evening);
    return {
      date: match.date,
      words: match.words,
      fromScripture,
      excerpt: fromScripture ? morning : evening,
    };
  };
