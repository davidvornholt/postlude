import { readAfterSettlingBrowserAutosaves } from './browser-autosaves.ts';
import type { ReviewView } from './review-view.ts';
import type { ReviewQueryParams } from './schemas/review-query.ts';

export const readReviewRoute = (
  input: ReviewQueryParams,
): Promise<ReviewView> =>
  readAfterSettlingBrowserAutosaves(async () => {
    const { readReviewFn } = await import('./services/review-fns.ts');
    return readReviewFn({ data: input });
  });
