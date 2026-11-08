import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserHistory, RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';

import { rangeOfSearch } from '../src/features/journal/insights-address.ts';
import { rangeDates } from '../src/features/journal/insights-range.ts';
import type {
  InsightsDay,
  InsightsView,
} from '../src/features/journal/insights-view.ts';
import type { JournalDate } from '../src/features/journal/journal-day.ts';
import type { EntryDraft } from '../src/features/journal/schemas/entry.ts';
import type { InsightsQueryParams } from '../src/features/journal/schemas/insights-query.ts';
import { unratedDay } from '../src/features/journal/testing/insights-view.ts';
import { countJournalWords } from '../src/features/journal/word-count.ts';
import type { InsightsNavigationFixtureWindow } from './insights-navigation-fixture-contract.ts';
import { createInsightsNavigationRouter } from './insights-navigation-router.tsx';

const fixtureWindow = globalThis as unknown as InsightsNavigationFixtureWindow;
const config = fixtureWindow.postludeInsightsNavigationFixture;
/**
 * What the fixture's journal holds: one invented day a year back, so there is
 * a past to step into, and the days a save writes.
 */
const earlierDay: InsightsDay = {
  ...unratedDay('2025-06-14'),
  journalWords: 120,
};
const stored = new Map<JournalDate, InsightsDay>([
  [earlierDay.date, earlierDay],
]);
let revision = new Date(config.entry.updatedAt).getTime();
let releaseInsightsRead = (): void => undefined;
const firstInsightsRead = new Promise<void>((resolve) => {
  releaseInsightsRead = resolve;
});
let firstReadPending = config.deferFirstInsightsRead;

const saveDelayMs = 75;
const save = async (
  draft: EntryDraft,
): Promise<{ readonly revision: number }> => {
  await new Promise((resolve) => setTimeout(resolve, saveDelayMs));
  if (config.saveOutcome === 'failed') {
    throw new TypeError('offline');
  }
  stored.set(draft.date, {
    ...unratedDay(draft.date),
    journalWords: countJournalWords(draft.journalMarkdown),
  });
  revision += 1;
  document.documentElement.dataset.storedRevision = String(revision);
  return { revision };
};

const viewOf = (query: InsightsQueryParams): InsightsView => {
  const [earliest] = [...stored.keys()].sort();
  const range = rangeOfSearch(query, config.today, earliest);
  const written = stored.size > 0;
  return {
    range,
    today: config.today,
    earliest,
    days: rangeDates(range).map((date) => stored.get(date) ?? unratedDay(date)),
    categories: [],
    journalStreak: written
      ? { current: 1, longest: 1 }
      : { current: 0, longest: 0 },
    scriptureStreak: { current: 0, longest: 0 },
    longestEntry: undefined,
    yearAgo: undefined,
    exportAvailable: written,
  };
};

const countRead = (): void => {
  const { dataset } = document.documentElement;
  dataset.insightsReads = String(Number(dataset.insightsReads ?? '0') + 1);
};

fixtureWindow.postludeInsightsNavigationRuntime = {
  readInsights: async (query) => {
    // The read sees the journal as it was when the read began, as the
    // server's would.
    const snapshot = viewOf(query);
    countRead();
    if (firstReadPending) {
      firstReadPending = false;
      document.documentElement.dataset.insightsReadStarted = 'true';
      await firstInsightsRead;
    }
    if (config.insightsReadOutcome === 'failed') {
      throw new TypeError('The insights transport failed.');
    }
    return snapshot;
  },
  releaseInsightsRead,
};

const router = createInsightsNavigationRouter({
  config,
  history: createBrowserHistory(),
  save,
});
await router.load();

const root = document.querySelector('#insights-navigation-fixture');
if (root === null) {
  throw new Error('The insights navigation fixture root is missing.');
}

createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
document.documentElement.dataset.insightsReads = '0';
document.documentElement.dataset.hydrated = 'true';
