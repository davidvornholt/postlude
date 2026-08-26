import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';

import {
  SearchQuery,
  type SearchQueryParams,
  searchJournalFn,
} from '#/features/journal/services/search-fns.ts';
import { SearchPage } from '#/features/journal/ui/search-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * The search, at `/search?q=rain`.
 *
 * The typed line is untrusted text like any other input, so it is decoded
 * against the server function's own schema before it reaches the loader. A line
 * that is too long, or a `q` that arrives as something other than text, falls
 * back to the empty search rather than failing the page: an address that cannot
 * be searched for is a search with no answer, not a page that does not exist.
 */
const decodeSearch = Schema.decodeUnknownOption(SearchQuery);

const searchParams = (search: Record<string, unknown>): SearchQueryParams =>
  Option.getOrElse(decodeSearch(search), (): SearchQueryParams => ({}));

const SearchRoute = () => <SearchPage results={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/search')({
  validateSearch: searchParams,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => searchJournalFn({ data: { q: deps.q } }),
  component: SearchRoute,
  head: () => ({ meta: [{ title: pageTitle('Search') }] }),
});
