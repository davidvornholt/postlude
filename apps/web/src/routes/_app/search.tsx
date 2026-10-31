import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect } from 'react';

import { searchJournalFn } from '#/features/journal/services/search-fns.ts';
import { SearchPage } from '#/features/journal/ui/search-page.tsx';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';
import {
  handleSearchPost,
  loadSearchView,
  searchAddressQuery,
} from './-search-request.ts';

/**
 * `/search?q=` opens on the answer to its words, so a bookmark or a browser's
 * search keyword can land on results. The page's own form still posts its
 * words. Once hydrated, the page replaces the current history entry with the
 * bare address, because the field and the address would disagree after the
 * next search and the words need not stay in the address bar. This can't take
 * back the request that already went out with them.
 */
const SearchRoute = () => {
  const search = useServerFn(searchJournalFn);
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (q !== undefined) {
      navigate({ replace: true, search: {} }).catch(() => undefined);
    }
  }, [navigate, q]);
  return <SearchPage search={search} view={Route.useLoaderData()} />;
};

export const Route = createFileRoute('/_app/search')({
  server: {
    middleware: [sessionRequired],
    handlers: {
      POST: (input) => handleSearchPost(input, searchJournalFn),
    },
  },
  validateSearch: searchAddressQuery,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps, serverContext }) =>
    loadSearchView(serverContext, searchJournalFn, deps.q),
  component: SearchRoute,
  head: () => ({ meta: [{ title: pageTitle('Search') }] }),
});
