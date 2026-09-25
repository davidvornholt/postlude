import { Schema } from 'effect';
import { JournalDateSchema } from './schemas/entry.ts';
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
  text: string,
  evidence: ReadonlyArray<SearchMatch['evidence'][number]>,
): SearchHitSource['excerpts'][number] => {
  const characters = Array.from(text);
  const ranges = evidence
    .map(({ matchStart, matchLength }) => ({
      start: matchStart,
      end: matchStart + matchLength,
    }))
    .sort((a, b) => a.start - b.start);
  const segments: Array<{ text: string; match: boolean; at: number }> = [];
  let cursor = 0;
  let offset = 0;
  const append = (start: number, end: number, match: boolean) => {
    const content = characters.slice(start, end).join('');
    if (content !== '') {
      segments.push({ text: content, match, at: offset });
      offset += content.length;
    }
  };
  for (const range of ranges) {
    if (range.end > cursor) {
      append(cursor, range.start, false);
      append(Math.max(cursor, range.start), range.end, true);
      cursor = range.end;
    }
  }
  append(cursor, characters.length, false);
  return segments;
};

/** Only verified source coordinates are highlighted: a cropped suffix is not a new token. */
export const searchHitOf = (match: SearchMatch): SearchHit => ({
  date: match.date,
  words: match.words,
  sources: (
    ['evening', 'scripture-notes', 'passage-reference'] as const
  ).flatMap((kind) => {
    const groups = new Map<number, Array<SearchMatch['evidence'][number]>>();
    for (const evidence of match.evidence) {
      if (evidence.kind === kind) {
        const group = groups.get(evidence.textIndex) ?? [];
        group.push(evidence);
        groups.set(evidence.textIndex, group);
      }
    }
    const excerpts = [...groups].map(([index, evidence]) =>
      excerptOf(match.texts[index] ?? '', evidence),
    );
    return excerpts.length === 0 ? [] : [{ kind, excerpts }];
  }),
});
