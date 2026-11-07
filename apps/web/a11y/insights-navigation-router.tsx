import {
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import { readInsightsRoute } from '../src/features/journal/browser-insights-navigation.ts';
import { confirmedRevisions } from '../src/features/journal/confirmed-revisions.ts';
import { journalDateLabel } from '../src/features/journal/day-label.ts';
import type { JournalDate } from '../src/features/journal/journal-day.ts';
import type { JournalEntry } from '../src/features/journal/schemas/entry.ts';
import { insightsSearchOf } from '../src/features/journal/schemas/insights-query.ts';
import {
  emptyEvening,
  noWrittenDays,
  unansweredEveningActions,
} from '../src/features/journal/testing/evening-view.ts';
import type { SaveDraft } from '../src/features/journal/ui/use-autosave.ts';
import { IconDefaults } from '../src/shared/ui/icon-defaults.tsx';
import { NavigationFocus } from '../src/shared/ui/navigation-focus';
import { pageTitle } from '../src/shared/ui/page-title.ts';
import { RouterError } from '../src/shared/ui/router-fallbacks.tsx';
import { journalEntryFromFixture } from './day-page-fixture-contract.ts';
import { AppShell, DayPage } from './insights-navigation-day-module.ts';
import type { InsightsNavigationFixtureConfig } from './insights-navigation-fixture-contract.ts';
import { InsightsPage } from './insights-navigation-page-module.ts';
import { createReadingNavigationRoutes } from './insights-navigation-reading-routes.tsx';

type InsightsNavigationDependencies = {
  readonly config: InsightsNavigationFixtureConfig;
  readonly history: RouterHistory;
  readonly save: SaveDraft;
};

const NavigationRoot = () => (
  <IconDefaults>
    <HeadContent />
    <NavigationFocus />
    <Outlet />
  </IconDefaults>
);

export const createInsightsNavigationRouter = ({
  config,
  history,
  save,
}: InsightsNavigationDependencies) => {
  const storedEntry = journalEntryFromFixture(config.entry);
  const entryOn = (date: JournalDate): JournalEntry =>
    date === storedEntry.date
      ? storedEntry
      : { ...storedEntry, date, journalMarkdown: '', journalWordCount: 0 };
  const loadEntryOn = (date: JournalDate): JournalEntry => {
    const loader = confirmedRevisions.beginLoad();
    const entry = entryOn(date);
    const result = confirmedRevisions.completeLoad(loader, [
      { date: entry.date, revision: entry.revision },
    ]);
    if (result === 'retry') {
      throw new Error('The fixture produced a stale journal entry.');
    }
    return entry;
  };
  const loadDayOn = (date: JournalDate) => {
    const entry = loadEntryOn(date);
    return { entry, evening: emptyEvening(entry.date, entry.revision) };
  };
  const rootRoute = createRootRoute({ component: NavigationRoot });
  const appRoute = createRoute({
    component: AppShell,
    getParentRoute: () => rootRoute,
    id: 'app',
  });
  const todayRoute = createRoute({
    component: () => {
      const { entry, evening } = todayRoute.useLoaderData();
      return (
        <DayPage
          anniversaries={[]}
          entry={entry}
          evening={evening}
          eveningActions={unansweredEveningActions}
          readWrittenDays={noWrittenDays}
          save={save}
          today={config.today}
        />
      );
    },
    getParentRoute: () => appRoute,
    head: () => ({ meta: [{ title: pageTitle('Today') }] }),
    loader: () => loadDayOn(config.today),
    path: '/',
  });
  const datedRoute = createRoute({
    component: () => {
      const { entry, evening } = datedRoute.useLoaderData();
      return (
        <DayPage
          anniversaries={[]}
          entry={entry}
          evening={evening}
          eveningActions={unansweredEveningActions}
          readWrittenDays={noWrittenDays}
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
    loader: ({ params }) => loadDayOn(params.date as JournalDate),
    path: '/day/$date',
  });
  const insightsRoute = createRoute({
    component: () => <InsightsPage view={insightsRoute.useLoaderData()} />,
    getParentRoute: () => appRoute,
    head: () => ({ meta: [{ title: pageTitle('Insights') }] }),
    loader: ({ deps }) => readInsightsRoute(deps),
    loaderDeps: ({ search }) => search,
    path: '/insights',
    validateSearch: insightsSearchOf,
  });
  return createRouter({
    defaultErrorComponent: RouterError,
    history,
    routeTree: rootRoute.addChildren([
      appRoute.addChildren([
        todayRoute,
        datedRoute,
        insightsRoute,
        ...createReadingNavigationRoutes({ appRoute, config }),
      ]),
    ]),
  });
};
