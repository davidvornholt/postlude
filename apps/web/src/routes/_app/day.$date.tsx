import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { journalDateLabel } from '#/features/journal/day-label.ts';
import { isJournalDate } from '#/features/journal/journal-day.ts';
import {
  readDatedJournalDay,
  saveDraft,
} from '#/features/journal/services/journal-fns.ts';
import { DayPage } from '#/features/journal/ui/day-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * Any other day, at `/day/2026-08-25`.
 *
 * A date in the address is untrusted text, so it is checked before it reaches a
 * loader. Anything that is not a calendar date is not a day of this journal and
 * gets the not-found page — the same answer as a misspelt path, because that is
 * what it is. Valid dates are readable even when they are ahead of the server's
 * current journal day: a row may have been written from another clock, or the
 * writer may be planning tomorrow. A missing date still opens as a blank draft,
 * so the same rule applies to reading, editing, and saving every valid day.
 *
 * Today is served at `/`, and reaching it through this route redirects there,
 * so the page the writer opens every evening has one address rather than two
 * that drift apart in a bookmark or a browser's history.
 */
const DayRoute = () => {
  const { entry, today } = Route.useLoaderData();
  return <DayPage entry={entry} save={saveDraft} today={today} />;
};

export const Route = createFileRoute('/_app/day/$date')({
  params: {
    parse: ({ date }) => {
      if (!isJournalDate(date)) {
        throw notFound();
      }
      return { date };
    },
    stringify: ({ date }) => ({ date }),
  },
  loader: async ({ params }) => {
    const result = await readDatedJournalDay({ data: { date: params.date } });
    if (result.disposition === 'today') {
      throw redirect({ to: '/' });
    }
    return result.view;
  },
  component: DayRoute,
  head: ({ loaderData, match }) => {
    let title = 'Journal day';
    if (loaderData !== undefined) {
      title = journalDateLabel(loaderData.entry.date);
    } else if (match.status === 'notFound') {
      title = 'Page not found';
    } else if (match.status === 'error') {
      title = 'Journal unavailable';
    }
    return { meta: [{ title: pageTitle(title) }] };
  },
});
