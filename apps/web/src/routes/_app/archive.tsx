import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';
import { readArchiveRoute } from '#/features/journal/browser-archive-navigation.ts';
import {
  ArchiveQuery,
  type ArchiveQueryParams,
} from '#/features/journal/schemas/archive-query.ts';
import { ArchivePage } from '#/features/journal/ui/archive-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * The archive, at `/archive`, optionally pointed at one year with `?year=2025`.
 *
 * The year in the address is untrusted text like any other input, so it is
 * decoded against the server function's own schema before it reaches the
 * loader, and anything that is not a year falls back to the rolling window
 * rather than failing the page. A mistyped address here is a view that does not
 * exist, not a day that does not exist, so it does not deserve the not-found
 * page the way `/day/<nonsense>` does.
 *
 * The page sets the shared frame itself, because the shell hands no frame to
 * any page. That frame is the width a year of days needs, which is where it
 * came from: the archive is the page that set it for all the others.
 */
const decodeSearch = Schema.decodeUnknownOption(ArchiveQuery);

const archiveSearch = (search: Record<string, unknown>): ArchiveQueryParams =>
  Option.getOrElse(decodeSearch(search), (): ArchiveQueryParams => ({}));

const ArchiveRoute = () => {
  const view = Route.useLoaderData();
  const { year } = Route.useSearch();
  return <ArchivePage selectedYear={year} view={view} />;
};

export const Route = createFileRoute('/_app/archive')({
  validateSearch: archiveSearch,
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: ({ deps }) => readArchiveRoute({ year: deps.year }),
  component: ArchiveRoute,
  head: () => ({ meta: [{ title: pageTitle('Archive') }] }),
});
