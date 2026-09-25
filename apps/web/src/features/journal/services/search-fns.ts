/**
 * The search's server function: a typed line in, a page of days out.
 *
 * It carries `sessionRequired` like every other function here. A search result
 * is the journal's prose, so an unguarded one would hand over the contents of a
 * private journal to anyone who could guess a word in it.
 *
 * The database returns bounded windows from stored search evidence. This boundary
 * highlights those windows without loading complete matching entry projections.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { searchTransportBoundary } from '../errors/search-errors.ts';
import {
  SearchQuery,
  type SearchResults,
  searchHitOf,
} from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';
import { EntrySearch } from './entry-search.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

/** As many days as one page shows. The writer refines rather than scrolls. */
const searchLimit = 50;

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
          const matches = yield* entries.search(terms, searchLimit);
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
