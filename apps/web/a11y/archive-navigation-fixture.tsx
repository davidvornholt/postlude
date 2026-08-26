import { RouterProvider } from '@tanstack/react-router';
import { hydrateRoot } from 'react-dom/client';

import { activityTotals } from '../src/features/journal/activity.ts';
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

const saveDelayMs = 75;
const isoYearEnd = 4;
const save = async (draft: {
  readonly journalMarkdown: string;
}): Promise<{ readonly revision: number }> => {
  await new Promise((resolve) => setTimeout(resolve, saveDelayMs));
  const day = {
    date: config.today,
    journalWords: countJournalWords(draft.journalMarkdown),
    scriptureWords: 0,
    hasScripture: false,
    writtenOnTheDay: true,
  };
  revision += 1;
  view = {
    ...view,
    days: [day],
    years: [Number(config.today.slice(0, isoYearEnd))],
    journalStreak: { current: 1, longest: 1 },
    totals: activityTotals([day]),
  };
  document.documentElement.dataset.storedRevision = String(revision);
  return { revision };
};

const router = createArchiveNavigationRouter({
  config,
  readArchive: () => Promise.resolve(view),
  save,
});
await router.load();

const root = document.querySelector('#archive-navigation-fixture');
if (root === null) {
  throw new Error('The archive navigation fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
document.documentElement.dataset.hydrated = 'true';
