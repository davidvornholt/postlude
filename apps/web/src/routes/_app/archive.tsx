import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';
import { readAfterSettlingBrowserAutosaves } from '#/features/journal/browser-autosaves.ts';
import {
  ArchiveQuery,
  type ArchiveQueryParams,
} from '#/features/journal/schemas/archive-query.ts';
import { readArchiveFn } from '#/features/journal/services/archive-fns.ts';
import { exportJournalFn } from '#/features/journal/services/export-fns.ts';
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
 * The page sets its own measure — the wider one, which a year of days needs —
 * because the shell hands no column to any page.
 */
const decodeSearch = Schema.decodeUnknownOption(ArchiveQuery);

const archiveSearch = (search: Record<string, unknown>): ArchiveQueryParams =>
  Option.getOrElse(decodeSearch(search), (): ArchiveQueryParams => ({}));

const ArchiveRoute = () => {
  const view = Route.useLoaderData();
  const { year } = Route.useSearch();
  return (
    <ArchivePage download={exportJournalFn} selectedYear={year} view={view} />
  );
};

export const Route = createFileRoute('/_app/archive')({
  validateSearch: archiveSearch,
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: ({ deps }) =>
    readAfterSettlingBrowserAutosaves(() =>
      readArchiveFn({ data: { year: deps.year } }),
    ),
  component: ArchiveRoute,
  head: () => ({ meta: [{ title: pageTitle('Archive') }] }),
});
