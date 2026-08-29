import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserHistory, RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';

import {
  activityTotals,
  activityWindow,
} from '../src/features/journal/activity.ts';
import type { ArchiveQueryParams } from '../src/features/journal/schemas/archive-query.ts';
import type { EntryDraft } from '../src/features/journal/schemas/entry.ts';
import { countJournalWords } from '../src/features/journal/word-count.ts';
import type { ArchiveNavigationFixtureWindow } from './archive-navigation-fixture-contract.ts';
import {
  createArchiveNavigationRouter,
  emptyArchiveView,
} from './archive-navigation-router.tsx';

const fixtureWindow = globalThis as unknown as ArchiveNavigationFixtureWindow;
const config = fixtureWindow.postludeArchiveNavigationFixture;
let view = emptyArchiveView(config);
let revision = new Date(config.entry.updatedAt).getTime();
let releaseArchiveRead = (): void => undefined;
const firstArchiveRead = new Promise<void>((resolve) => {
  releaseArchiveRead = resolve;
});
let firstReadPending = config.deferFirstArchiveRead;

const saveDelayMs = 75;
const isoYearEnd = 4;
const save = async (
  draft: EntryDraft,
): Promise<{ readonly revision: number }> => {
  await new Promise((resolve) => setTimeout(resolve, saveDelayMs));
  if (config.saveOutcome === 'failed') {
    throw new TypeError('offline');
  }
  const day = {
    date: draft.date,
    journalWords: countJournalWords(draft.journalMarkdown),
    scriptureWords: 0,
    hasScripture: false,
    journalWrittenOnTheDay: true,
    scriptureUsedOnTheDay: false,
  };
  revision += 1;
  view = {
    ...view,
    exportAvailable: true,
    days: [...view.days.filter(({ date }) => date !== day.date), day],
    years: [Number(draft.date.slice(0, isoYearEnd))],
    journalStreak: { current: 1, longest: 1 },
    totals: activityTotals([day]),
  };
  document.documentElement.dataset.storedRevision = String(revision);
  return { revision };
};

fixtureWindow.postludeArchiveNavigationRuntime = {
  readArchive: async (year: ArchiveQueryParams['year']) => {
    const snapshot = view;
    const reads = Number(document.documentElement.dataset.archiveReads ?? '0');
    document.documentElement.dataset.archiveReads = String(reads + 1);
    if (firstReadPending) {
      firstReadPending = false;
      document.documentElement.dataset.archiveReadStarted = 'true';
      await firstArchiveRead;
    }
    if (config.archiveReadOutcome === 'failed') {
      throw new TypeError('The archive transport failed.');
    }
    return { ...snapshot, window: activityWindow(config.today, year) };
  },
  releaseArchiveRead,
};

const router = createArchiveNavigationRouter({
  config,
  history: createBrowserHistory(),
  save,
});
await router.load();

const root = document.querySelector('#archive-navigation-fixture');
if (root === null) {
  throw new Error('The archive navigation fixture root is missing.');
}

createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
document.documentElement.dataset.archiveReads = '0';
document.documentElement.dataset.hydrated = 'true';
