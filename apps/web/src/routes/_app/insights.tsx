import { createFileRoute } from '@tanstack/react-router';

import { readInsightsRoute } from '#/features/journal/browser-insights-navigation.ts';
import { insightsSearchOf } from '#/features/journal/schemas/insights-query.ts';
import { InsightsPage } from '#/features/journal/ui/insights-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * Insights, at `/insights`: this year when nothing else is asked for, or a
 * week, a month, another year, or all time.
 *
 * The range in the address is untrusted text like any other input, so it is
 * decoded against the server function's own schema before it reaches the
 * loader, and anything that does not decode falls back to this year rather
 * than failing the page. A mistyped address here is a view that does not
 * exist, not a day that does not exist, so it does not deserve the not-found
 * page the way `/day/<nonsense>` does.
 */
const InsightsRoute = () => <InsightsPage view={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/insights')({
  validateSearch: insightsSearchOf,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => readInsightsRoute(deps),
  component: InsightsRoute,
  head: () => ({ meta: [{ title: pageTitle('Insights') }] }),
});
