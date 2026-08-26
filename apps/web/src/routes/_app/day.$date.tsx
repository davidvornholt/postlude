import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { journalDateLabel } from '#/features/journal/day-label.ts';
import { isJournalDate } from '#/features/journal/journal-day.ts';
import {
  readJournalDay,
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
 * what it is.
 *
 * Today is served at `/`, and reaching it through this route redirects there,
 * so the page the writer opens every evening has one address rather than two
 * that drift apart in a bookmark or a browser's history.
 */
const DayRoute = () => {
  const { entry, today, anniversaries } = Route.useLoaderData();
  return (
    <DayPage
      anniversaries={anniversaries}
      entry={entry}
      save={saveDraft}
      today={today}
    />
  );
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
    const day = await readJournalDay({ data: { date: params.date } });
    if (day.entry.date === day.today) {
      throw redirect({ to: '/' });
    }
    /*
     * A day the writer has not lived yet has nothing to hold and no way to be
     * written honestly, so it is not a page. The comparison is against the
     * server's day rather than the browser's, so a device with a wrong clock or
     * in another zone cannot talk its way into one.
     */
    if (day.entry.date > day.today) {
      throw notFound();
    }
    return day;
  },
  component: DayRoute,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: pageTitle(
          loaderData === undefined
            ? 'Day'
            : journalDateLabel(loaderData.entry.date),
        ),
      },
    ],
  }),
});
