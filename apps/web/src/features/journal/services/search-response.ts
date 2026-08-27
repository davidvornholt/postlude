import { isJournalDate } from '../journal-day.ts';
import type { SearchHitSource } from '../search-contract.ts';
import type { ExcerptSegment } from '../search-excerpt.ts';
import type { SearchResults } from './search-fns.ts';

export type SearchResponse =
  | { readonly state: 'answered'; readonly results: SearchResults }
  | { readonly state: 'authentication-required' }
  | { readonly state: 'failed' };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const isExcerptSegment = (value: unknown): value is ExcerptSegment =>
  isRecord(value) &&
  typeof value.text === 'string' &&
  typeof value.match === 'boolean' &&
  typeof value.at === 'number' &&
  Number.isSafeInteger(value.at) &&
  value.at >= 0;

const sourceKinds = new Set([
  'evening',
  'passage-reference',
  'scripture-notes',
]);
const unauthorized = 401;
const forbidden = 403;

const isSearchHitSource = (value: unknown): value is SearchHitSource =>
  isRecord(value) &&
  typeof value.kind === 'string' &&
  sourceKinds.has(value.kind) &&
  Array.isArray(value.excerpts) &&
  value.excerpts.every(
    (excerpt) =>
      Array.isArray(excerpt) &&
      excerpt.every((segment) => isExcerptSegment(segment)),
  );

const isSearchHit = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.date === 'string' &&
  isJournalDate(value.date) &&
  typeof value.words === 'number' &&
  Number.isSafeInteger(value.words) &&
  value.words >= 0 &&
  Array.isArray(value.sources) &&
  value.sources.every(isSearchHitSource);

const isSearchResults = (value: unknown): value is SearchResults =>
  isRecord(value) &&
  typeof value.query === 'string' &&
  typeof value.today === 'string' &&
  isJournalDate(value.today) &&
  Array.isArray(value.terms) &&
  value.terms.every((term) => typeof term === 'string') &&
  Array.isArray(value.hits) &&
  value.hits.every(isSearchHit) &&
  typeof value.limited === 'boolean';

/** Classifies an untrusted server-function resolution without reading its body. */
export const searchResponseOf = (value: unknown): SearchResponse => {
  if (value instanceof Response) {
    return value.status === unauthorized || value.status === forbidden
      ? { state: 'authentication-required' }
      : { state: 'failed' };
  }
  return isSearchResults(value)
    ? { state: 'answered', results: value }
    : { state: 'failed' };
};
