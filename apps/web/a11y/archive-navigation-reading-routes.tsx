import { type AnyRoute, createRoute } from '@tanstack/react-router';

import { isoMonthStart } from '../src/features/journal/anniversary.ts';
import { journalMonthOf } from '../src/features/journal/calendar.ts';
import type { CalendarQueryParams } from '../src/features/journal/schemas/calendar-query.ts';
import { decodeCalendarQuery } from '../src/features/journal/schemas/calendar-query.ts';
import type { OnThisDayQueryParams } from '../src/features/journal/schemas/on-this-day-query.ts';
import { decodeOnThisDayQuery } from '../src/features/journal/schemas/on-this-day-query.ts';
import type { CalendarView } from '../src/features/journal/services/calendar-fns.ts';
import type { OnThisDayView } from '../src/features/journal/services/on-this-day-fns.ts';
import { CalendarPage } from '../src/features/journal/ui/calendar-page.tsx';
import { OnThisDayPage } from '../src/features/journal/ui/on-this-day-page.tsx';
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

const onThisDayViewOn = (
  config: ArchiveNavigationFixtureConfig,
  query: OnThisDayQueryParams,
): OnThisDayView => {
  const date = query.date ?? config.today;
  return {
    anniversaries: [
      {
        date: `2025-${date.slice(isoMonthStart)}`,
        yearsAgo: 1,
        words: 42,
        snippet: 'A memory from this date.',
      },
    ],
    date,
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
  const onThisDayRoute = createRoute({
    component: () => <OnThisDayPage view={onThisDayRoute.useLoaderData()} />,
    getParentRoute: () => appRoute,
    head: () => ({ meta: [{ title: pageTitle('On this day') }] }),
    loader: ({ deps }) => onThisDayViewOn(config, deps),
    loaderDeps: ({ search }) => search,
    path: '/on-this-day',
    validateSearch: decodeOnThisDayQuery,
  });
  return [calendarRoute, onThisDayRoute];
};
