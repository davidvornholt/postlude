import {
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';

import { activityWindow } from '../src/features/journal/activity.ts';
import { readArchiveRoute } from '../src/features/journal/browser-archive-navigation.ts';
import { journalDateLabel } from '../src/features/journal/day-label.ts';
import type { JournalDate } from '../src/features/journal/journal-day.ts';
import type { JournalEntry } from '../src/features/journal/schemas/entry.ts';
import type { ArchiveView } from '../src/features/journal/services/archive-fns.ts';
import type { SaveDraft } from '../src/features/journal/ui/use-autosave.ts';
import { pageTitle } from '../src/shared/ui/page-title.ts';
import { RouterError } from '../src/shared/ui/router-fallbacks.tsx';
import { ArchivePage } from './archive-navigation-archive-module.ts';
import { AppShell, DayPage } from './archive-navigation-day-module.ts';
import type { ArchiveNavigationFixtureConfig } from './archive-navigation-fixture-contract.ts';
import { journalEntryFromFixture } from './day-page-fixture-contract.ts';

type ArchiveNavigationDependencies = {
  readonly config: ArchiveNavigationFixtureConfig;
  readonly history: RouterHistory;
  readonly save: SaveDraft;
};

const NavigationRoot = () => (
  <>
    <HeadContent />
    <Outlet />
  </>
);

export const emptyArchiveView = (
  config: ArchiveNavigationFixtureConfig,
): ArchiveView => ({
  today: config.today,
  exportAvailable: false,
  window: activityWindow(config.today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
});

export const createArchiveNavigationRouter = ({
  config,
  history,
  save,
}: ArchiveNavigationDependencies) => {
  const storedEntry = journalEntryFromFixture(config.entry);
  const entryOn = (date: JournalDate): JournalEntry =>
    date === storedEntry.date
      ? storedEntry
      : { ...storedEntry, date, journalMarkdown: '', journalWordCount: 0 };
  const rootRoute = createRootRoute({ component: NavigationRoot });
  const appRoute = createRoute({
    component: AppShell,
    getParentRoute: () => rootRoute,
    id: 'app',
  });
  const todayRoute = createRoute({
    component: () => (
      <DayPage
        anniversaries={[]}
        entry={entryOn(config.today)}
        save={save}
        today={config.today}
      />
    ),
    getParentRoute: () => appRoute,
    head: () => ({ meta: [{ title: pageTitle('Today') }] }),
    path: '/',
  });
  const datedRoute = createRoute({
    component: () => {
      const { entry } = datedRoute.useLoaderData();
      return (
        <DayPage
          anniversaries={[]}
          entry={entry}
          save={save}
          today={config.today}
        />
      );
    },
    getParentRoute: () => appRoute,
    head: ({ params }) => ({
      meta: [
        {
          title: pageTitle(journalDateLabel(params.date as JournalDate)),
        },
      ],
    }),
    loader: ({ params }) => ({ entry: entryOn(params.date as JournalDate) }),
    path: '/day/$date',
  });
  const archiveRoute = createRoute({
    component: () => (
      <ArchivePage
        selectedYear={undefined}
        view={archiveRoute.useLoaderData()}
      />
    ),
    getParentRoute: () => appRoute,
    head: () => ({ meta: [{ title: pageTitle('Archive') }] }),
    loader: () => readArchiveRoute({}),
    path: '/archive',
  });

  return createRouter({
    defaultErrorComponent: RouterError,
    history,
    routeTree: rootRoute.addChildren([
      appRoute.addChildren([todayRoute, datedRoute, archiveRoute]),
    ]),
  });
};
