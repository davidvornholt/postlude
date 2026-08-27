/**
 * The search's server function: a typed line in, a page of days out.
 *
 * It carries `sessionRequired` like every other function here. A search result
 * is the journal's prose, so an unguarded one would hand over the contents of a
 * private journal to anyone who could guess a word in it.
 *
 * The excerpt is cut here rather than in the browser. The alternative is sending
 * every matching day's markdown and cutting it there, which means shipping a
 * page of entries in full so that a couple of lines of each can be shown.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { searchTransportBoundary } from '../errors/search-errors.ts';
import type { JournalDate } from '../journal-day.ts';
import {
  type SearchHit as ContractSearchHit,
  type SearchQueryParams as ContractSearchQueryParams,
  SearchQuery as SearchQueryContract,
  searchHitOf,
} from '../search-contract.ts';
import { searchTerms, searchTsQuery } from '../search-query.ts';
import { EntrySearch } from './entry-search.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

/** As many days as one page shows. The writer refines rather than scrolls. */
const searchLimit = 50;

export const SearchQuery = SearchQueryContract;
export type SearchQueryParams = ContractSearchQueryParams;
export type SearchHit = ContractSearchHit;

export type SearchResults = {
  /** The line as typed, so the page can say what it answered. */
  readonly query: string;
  /** Which day today is, so a result for it links to the page it lives on. */
  readonly today: JournalDate;
  /** The words it was reduced to; empty means nothing was actually asked. */
  readonly terms: ReadonlyArray<string>;
  readonly hits: ReadonlyArray<SearchHit>;
  /** There were at least this many; the page stopped counting at the limit. */
  readonly limited: boolean;
};

const decodeQuery = Schema.decodeUnknownSync(SearchQuery);

export const searchJournalFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeQuery(input ?? {}))
  .handler(({ data }): Promise<SearchResults> => {
    const query = data.q ?? '';
    const today = currentJournalDate();
    const terms = searchTerms(query);
    if (terms.length === 0) {
      return Promise.resolve({ query, today, terms, hits: [], limited: false });
    }
    return searchTransportBoundary(
      runJournalEffect(
        Effect.gen(function* () {
          const entries = yield* EntrySearch;
          const matches = yield* entries.search(
            searchTsQuery(terms),
            searchLimit,
          );
          return {
            query,
            today,
            terms,
            hits: matches.map(searchHitOf(terms)),
            limited: matches.length === searchLimit,
          };
        }),
      ),
    );
  });
