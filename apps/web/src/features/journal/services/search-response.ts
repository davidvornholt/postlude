import { Option, Schema } from 'effect';

import { SearchResults } from '../search-contract.ts';

export type SearchResponse =
  | { readonly state: 'answered'; readonly results: SearchResults }
  | { readonly state: 'authentication-required' }
  | { readonly state: 'failed' };

const unauthorized = 401;
const forbidden = 403;
const decodeResults = Schema.decodeUnknownOption(SearchResults);

/** Classifies an untrusted server-function resolution without reading its body. */
export const searchResponseOf = (value: unknown): SearchResponse => {
  if (value instanceof Response) {
    return value.status === unauthorized || value.status === forbidden
      ? { state: 'authentication-required' }
      : { state: 'failed' };
  }
  const results = decodeResults(value);
  return Option.isSome(results)
    ? { state: 'answered', results: results.value }
    : { state: 'failed' };
};
