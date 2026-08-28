import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';

import { readOnThisDayRoute } from '#/features/journal/browser-on-this-day-navigation.ts';
import {
  OnThisDayQuery,
  type OnThisDayQueryParams,
} from '#/features/journal/schemas/on-this-day-query.ts';
import { OnThisDayPage } from '#/features/journal/ui/on-this-day-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const decodeSearch = Schema.decodeUnknownOption(OnThisDayQuery);

const onThisDaySearch = (
  search: Record<string, unknown>,
): OnThisDayQueryParams =>
  Option.getOrElse(decodeSearch(search), (): OnThisDayQueryParams => ({}));

const OnThisDayRoute = () => {
  const view = Route.useLoaderData();
  return <OnThisDayPage view={view} />;
};

export const Route = createFileRoute('/_app/on-this-day')({
  validateSearch: onThisDaySearch,
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: ({ deps }) => readOnThisDayRoute({ date: deps.date }),
  component: OnThisDayRoute,
  head: () => ({ meta: [{ title: pageTitle('On this day') }] }),
});
