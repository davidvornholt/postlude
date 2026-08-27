import type { SearchResults } from '../search-contract.ts';

const one = 1;

/** A concise announcement for results rendered outside the live region. */
export const searchStatus = (results: SearchResults): string => {
  if (results.terms.length === 0) {
    return results.query === '' ? '' : 'Search needs a word.';
  }
  const count = results.hits.length;
  return count === 0
    ? 'No days found.'
    : `${count} day${count === one ? '' : 's'} found.`;
};
