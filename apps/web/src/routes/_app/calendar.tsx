import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';

import { readCalendarRoute } from '#/features/journal/browser-calendar-navigation.ts';
import { journalMonthOf } from '#/features/journal/calendar.ts';
import {
  CalendarQuery,
  type CalendarQueryParams,
} from '#/features/journal/schemas/calendar-query.ts';
import { CalendarPage } from '#/features/journal/ui/calendar-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const decodeSearch = Schema.decodeUnknownOption(CalendarQuery);

const calendarSearch = (search: Record<string, unknown>): CalendarQueryParams =>
  Option.getOrElse(decodeSearch(search), (): CalendarQueryParams => ({}));

const CalendarRoute = () => {
  const { day } = Route.useSearch();
  return <CalendarPage requestedDay={day} view={Route.useLoaderData()} />;
};

export const Route = createFileRoute('/_app/calendar')({
  validateSearch: calendarSearch,
  loaderDeps: ({ search }) => ({
    month:
      search.month ??
      (search.day === undefined ? undefined : journalMonthOf(search.day)),
  }),
  loader: ({ deps }) => readCalendarRoute({ month: deps.month }),
  component: CalendarRoute,
  head: () => ({ meta: [{ title: pageTitle('Calendar') }] }),
});
