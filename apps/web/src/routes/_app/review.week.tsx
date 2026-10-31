import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';

import { readReviewRoute } from '#/features/journal/browser-review-navigation.ts';
import {
  WeekReviewSearch,
  type WeekReviewSearchParams,
} from '#/features/journal/schemas/review-query.ts';
import { ReviewPage } from '#/features/journal/ui/review-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const decodeSearch = Schema.decodeUnknownOption(WeekReviewSearch);

const reviewSearch = (
  search: Record<string, unknown>,
): WeekReviewSearchParams =>
  Option.getOrElse(decodeSearch(search), (): WeekReviewSearchParams => ({}));

const WeekReviewRoute = () => <ReviewPage view={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/review/week')({
  validateSearch: reviewSearch,
  loaderDeps: ({ search }) => ({ week: search.week }),
  loader: ({ deps }) => readReviewRoute({ kind: 'week', week: deps.week }),
  component: WeekReviewRoute,
  head: () => ({ meta: [{ title: pageTitle('Week review') }] }),
});
