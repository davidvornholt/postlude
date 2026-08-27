import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
  useLoaderData,
} from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';

import { journalDateLabel } from '../src/features/journal/day-label.ts';
import type { JournalDate } from '../src/features/journal/journal-day.ts';
import type { JournalEntry } from '../src/features/journal/schemas/entry.ts';
import { pageTitle } from '../src/shared/ui/page-title.ts';
import { AppShell, DayPage } from './day-navigation-fixture-module.ts';

const today: JournalDate = '2026-08-26';

const entryOn = (date: JournalDate): JournalEntry => ({
  date,
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  scriptureFirstUsedAt: null,
  revision: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const save = () => Promise.resolve({ revision: 2 });

type FixtureDay = {
  readonly entry: JournalEntry;
  readonly today: JournalDate;
};

const useFixtureDay = (): FixtureDay =>
  useLoaderData({ strict: false }) as FixtureDay;

export const NavigationRoot = () => (
  <>
    <HeadContent />
    <Outlet />
  </>
);

export const TodayPage = () => {
  const loaded = useFixtureDay();
  return <DayPage entry={loaded.entry} save={save} today={loaded.today} />;
};

export const DatedPage = () => {
  const loaded = useFixtureDay();
  return <DayPage entry={loaded.entry} save={save} today={loaded.today} />;
};

const rootRoute = createRootRoute({ component: NavigationRoot });
const appRoute = createRoute({
  component: AppShell,
  getParentRoute: () => rootRoute,
  id: 'app',
});
const todayRoute = createRoute({
  component: TodayPage,
  getParentRoute: () => appRoute,
  head: () => ({ meta: [{ title: pageTitle('Today') }] }),
  loader: () => ({ entry: entryOn(today), today }),
  path: '/',
});
const datedRoute = createRoute({
  component: DatedPage,
  getParentRoute: () => appRoute,
  head: ({ params }) => ({
    meta: [
      {
        title: pageTitle(journalDateLabel(params.date as JournalDate)),
      },
    ],
  }),
  loader: ({ params }) => ({
    entry: entryOn(params.date as JournalDate),
    today,
  }),
  path: '/day/$date',
});

const queryClient = new QueryClient();
const router = createRouter({
  context: { queryClient },
  history: createBrowserHistory(),
  routeTree: rootRoute.addChildren([
    appRoute.addChildren([todayRoute, datedRoute]),
  ]),
});
await router.load();

const root = document.querySelector('#day-navigation-fixture');
if (root === null) {
  throw new Error('The day-navigation fixture root is missing.');
}

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
document.documentElement.dataset.hydrated = 'true';
