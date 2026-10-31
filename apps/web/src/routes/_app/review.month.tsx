import { createFileRoute } from '@tanstack/react-router';
import { Option, Schema } from 'effect';

import { readReviewRoute } from '#/features/journal/browser-review-navigation.ts';
import {
  MonthReviewSearch,
  type MonthReviewSearchParams,
} from '#/features/journal/schemas/review-query.ts';
import { ReviewPage } from '#/features/journal/ui/review-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

const decodeSearch = Schema.decodeUnknownOption(MonthReviewSearch);

const reviewSearch = (
  search: Record<string, unknown>,
): MonthReviewSearchParams =>
  Option.getOrElse(decodeSearch(search), (): MonthReviewSearchParams => ({}));

const MonthReviewRoute = () => <ReviewPage view={Route.useLoaderData()} />;

export const Route = createFileRoute('/_app/review/month')({
  validateSearch: reviewSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => readReviewRoute({ kind: 'month', month: deps.month }),
  component: MonthReviewRoute,
  head: () => ({ meta: [{ title: pageTitle('Month review') }] }),
});
