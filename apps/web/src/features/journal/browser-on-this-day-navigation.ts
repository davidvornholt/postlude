import { readAfterSettlingBrowserAutosaves } from './browser-autosaves.ts';
import type { OnThisDayQueryParams } from './schemas/on-this-day-query.ts';
import type { OnThisDayView } from './services/on-this-day-fns.ts';

export const readOnThisDayRoute = (
  input: OnThisDayQueryParams,
): Promise<OnThisDayView> =>
  readAfterSettlingBrowserAutosaves(async () => {
    const { readOnThisDayFn } = await import('./services/on-this-day-fns.ts');
    return readOnThisDayFn({ data: input });
  });
