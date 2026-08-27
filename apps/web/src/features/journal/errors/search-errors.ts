import { Data } from 'effect';

import { searchUnavailableMessage } from '../search-contract.ts';

/** The only database-search failure shape allowed across the server boundary. */
export class SearchUnavailableError extends Data.TaggedError(
  'SearchUnavailableError',
)<{
  readonly message: string;
}> {}

export const searchUnavailableError = (): SearchUnavailableError =>
  new SearchUnavailableError({ message: searchUnavailableMessage });

/** Replaces a logged internal rejection with the stable public search error. */
export const searchTransportBoundary = async <A>(
  operation: Promise<A>,
): Promise<A> =>
  operation.catch(() => Promise.reject(searchUnavailableError()));
