import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { isJournalDate } from '#/features/journal/journal-day.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * `/day?date=2026-08-20`, which is not a page but the way to one.
 *
 * A day lives at `/day/2026-08-20`, a path rather than a query. A plain HTML
 * form can only put what it collects into a query, so the day page's date field
 * submits here and this sends the writer on. That is what lets the field work
 * in a browser that ran no script: the redirect happens on the server, and the
 * writer lands on the day.
 *
 * The date is untrusted text like any other address, so it is checked here
 * rather than handed to the day route to fail on. A query that is not a
 * calendar date is not a day of this journal and gets the not-found page, the
 * same answer a misspelt path gets. A query with no date at all is not a
 * mistake — it is an empty field submitted — so it goes to today.
 */
export const Route = createFileRoute('/_app/day/')({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === 'string' ? search.date : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.date === undefined || search.date === '') {
      throw redirect({ to: '/' });
    }
    if (!isJournalDate(search.date)) {
      throw notFound();
    }
    throw redirect({ params: { date: search.date }, to: '/day/$date' });
  },
  head: () => ({ meta: [{ title: pageTitle('Day not found') }] }),
});
