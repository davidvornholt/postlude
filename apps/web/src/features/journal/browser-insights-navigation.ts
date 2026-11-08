/** A stable Insights snapshot handed from the writing page to its route loader. */

import { AutosaveSettlementError } from './autosave-registry.ts';
import {
  readAfterSettlingBrowserAutosaves,
  settleBrowserAutosaves,
} from './browser-autosaves.ts';
import type { InsightsView } from './insights-view.ts';
import type { InsightsQueryParams } from './schemas/insights-query.ts';

let preparedInsights: InsightsView | undefined;
let insightsFunctions:
  | Promise<typeof import('./services/insights-fns.ts')>
  | undefined;

const loadInsightsFunctions = () => {
  insightsFunctions ??= import('./services/insights-fns.ts');
  return insightsFunctions;
};

/** Warms the split Insights boundary without reading private journal data. */
export const preloadInsightsNavigation = (): void => {
  loadInsightsFunctions().catch(() => {
    insightsFunctions = undefined;
  });
};

const readInsights = (query: InsightsQueryParams): Promise<InsightsView> =>
  readAfterSettlingBrowserAutosaves(async () => {
    const { readInsightsFn } = await loadInsightsFunctions();
    return readInsightsFn({ data: query });
  });

/** Prepares the main Insights link before its current writing page can unmount. */
export const prepareInsightsNavigation = async (): Promise<void> => {
  try {
    preparedInsights = await readInsights({});
  } catch (error) {
    if (error instanceof AutosaveSettlementError) {
      throw error;
    }
    preparedInsights = undefined;
    // The route loader owns read failures. Settle once more first, because an
    // edit may have arrived while the failed pre-navigation read was pending.
    await settleBrowserAutosaves();
  }
};

export const discardPreparedInsightsNavigation = (): void => {
  preparedInsights = undefined;
};

const isDefaultQuery = (query: InsightsQueryParams): boolean =>
  !('range' in query) && query.year === undefined;

/** Consumes a prepared default view once; any other range reads now. */
export const readInsightsRoute = (
  query: InsightsQueryParams,
): Promise<InsightsView> => {
  const prepared = preparedInsights;
  preparedInsights = undefined;
  return isDefaultQuery(query) && prepared !== undefined
    ? Promise.resolve(prepared)
    : readInsights(query);
};
