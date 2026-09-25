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

const excerptOf = (
  evidence: SearchMatch['evidence'][number],
  terms: ReadonlyArray<string>,
): SearchHitSource['excerpts'][number] => {
  const term = terms[evidence.termIndex];
  if (term && searchExcerpts(evidence.text, [term]).excerpts.length > 0) {
    const [highlighted] = searchExcerpts(evidence.text, [
      term,
      ...terms.filter((value) => value !== term),
    ]).excerpts;
    if (highlighted) {
      return highlighted;
    }
  }
  const characters = Array.from(evidence.text);
  const before = characters.slice(0, evidence.matchStart).join('');
  const matched = characters
    .slice(evidence.matchStart, evidence.matchStart + evidence.matchLength)
    .join('');
  const after = characters
    .slice(evidence.matchStart + evidence.matchLength)
    .join('');
  return [
    { text: before, match: false, at: 0 },
    { text: matched, match: true, at: before.length },
    { text: after, match: false, at: before.length + matched.length },
  ].filter(({ text }) => text !== '');
};

/** Bounded database windows retain one attributed match for each contributing term. */
export const searchHitOf =
  (terms: ReadonlyArray<string>) =>
  (match: SearchMatch): SearchHit => ({
    date: match.date,
    words: match.words,
    sources: (
      ['evening', 'scripture-notes', 'passage-reference'] as const
    ).flatMap((kind) => {
      const excerpts = match.evidence
        .filter((evidence) => evidence.kind === kind)
        .map((evidence) => excerptOf(evidence, terms));
      const unique = [
        ...new Map(
          excerpts.map((excerpt) => [JSON.stringify(excerpt), excerpt]),
        ).values(),
      ];
      return unique.length === 0 ? [] : [{ kind, excerpts: unique }];
    }),
  });
