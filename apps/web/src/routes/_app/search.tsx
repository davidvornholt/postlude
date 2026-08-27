import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';

import { searchJournalFn } from '#/features/journal/services/search-fns.ts';
import { SearchPage } from '#/features/journal/ui/search-page.tsx';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';
import { handleSearchPost, loadSearchView } from './-search-request.ts';

const SearchRoute = () => {
  const search = useServerFn(searchJournalFn);
  return <SearchPage search={search} view={Route.useLoaderData()} />;
};

export const Route = createFileRoute('/_app/search')({
  server: {
    middleware: [sessionRequired],
    handlers: {
      POST: (input) => handleSearchPost(input, searchJournalFn),
    },
  },
  loader: ({ serverContext }) => loadSearchView(serverContext, searchJournalFn),
  component: SearchRoute,
  head: () => ({ meta: [{ title: pageTitle('Search') }] }),
});
