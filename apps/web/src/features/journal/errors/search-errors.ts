import { searchUnavailableMessage } from '../search-contract.ts';

/** The only database-search failure shape allowed across the wire boundary. */
export type SearchUnavailableWire = {
  readonly _tag: 'SearchUnavailableError';
  readonly message: string;
};

export type SearchFailureKind = 'authentication' | 'unavailable';

const unauthorized = 401;
const forbidden = 403;

const statusOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;

/** Reads only the public status needed to choose a recovery action. */
export const searchFailureKind = (error: unknown): SearchFailureKind => {
  const status = statusOf(error);
  return status === unauthorized || status === forbidden
    ? 'authentication'
    : 'unavailable';
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
