import { searchUnavailableMessage } from '../search-contract.ts';

/** The only database-search failure shape allowed across the wire boundary. */
export type SearchUnavailableWire = {
  readonly _tag: 'SearchUnavailableError';
  readonly message: string;
};

/** A plain object by design: Error instances let serializers expose diagnostics. */
export const searchUnavailableWire = (): SearchUnavailableWire => ({
  _tag: 'SearchUnavailableError',
  message: searchUnavailableMessage,
});

/** Replaces a logged internal rejection with the stable public search error. */
export const searchTransportBoundary = async <A>(
  operation: Promise<A>,
): Promise<A> => operation.catch(() => Promise.reject(searchUnavailableWire()));
