import { type AnyRoute, createRoute } from '@tanstack/react-router';

import { journalMonthOf } from '../src/features/journal/calendar.ts';
import type { CalendarQueryParams } from '../src/features/journal/schemas/calendar-query.ts';
import { decodeCalendarQuery } from '../src/features/journal/schemas/calendar-query.ts';
import type { CalendarView } from '../src/features/journal/services/calendar-fns.ts';
import { CalendarPage } from '../src/features/journal/ui/calendar-page.tsx';
import { pageTitle } from '../src/shared/ui/page-title.ts';
import type { ArchiveNavigationFixtureConfig } from './archive-navigation-fixture-contract.ts';

type ReadingRoutesInput = {
  readonly appRoute: AnyRoute;
  readonly config: ArchiveNavigationFixtureConfig;
};

const calendarViewOn = (
  config: ArchiveNavigationFixtureConfig,
  query: CalendarQueryParams,
): CalendarView => {
  const currentMonth = journalMonthOf(config.today);
  const month =
    query.month ??
    (query.day === undefined ? currentMonth : journalMonthOf(query.day));
  return {
    days:
      month === currentMonth
        ? [
            {
              date: '2026-08-19',
              hasScriptureReference: false,
              revision: 1,
              snippet: 'A selected calendar memory.',
              words: 42,
            },
          ]
        : [],
    earliest: '2026-08-01',
    month,
    today: config.today,
  };
};

export const createReadingNavigationRoutes = ({
  appRoute,
  config,
}: ReadingRoutesInput): ReadonlyArray<AnyRoute> => {
  const calendarRoute = createRoute({
    component: () => {
      const search = calendarRoute.useSearch();
      return (
        <CalendarPage
          requestedDay={search.day}
          view={calendarRoute.useLoaderData()}
        />
      );
    },
    getParentRoute: () => appRoute,
    head: () => ({ meta: [{ title: pageTitle('Calendar') }] }),
    loader: ({ deps }) => calendarViewOn(config, deps),
    loaderDeps: ({ search }) => search,
    path: '/calendar',
    validateSearch: decodeCalendarQuery,
  });
  return [calendarRoute];
};
