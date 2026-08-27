import { createFileRoute } from '@tanstack/react-router';
import {
  readTodayJournalDay,
  saveDraft,
} from '#/features/journal/services/journal-fns.ts';
import { DayPage } from '#/features/journal/ui/day-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * Today, at the plain address.
 *
 * Which day "today" is comes from the server, not from this route: it asks for
 * a day without naming one and the server answers with its own clock, under the
 * 04:00 rule. That is what keeps a phone opened at half past midnight on the
 * same page as the laptop it was left on.
 *
 * The page sets the shared frame itself rather than taking one from the shell,
 * because the morning scripture's deep register has to run edge to edge and
 * cannot escape a frame the shell has already closed around it.
 */
const TodayRoute = () => {
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

export const Route = createFileRoute('/_app/')({
  loader: () => readTodayJournalDay(),
  component: TodayRoute,
  head: () => ({ meta: [{ title: pageTitle('Today') }] }),
});
