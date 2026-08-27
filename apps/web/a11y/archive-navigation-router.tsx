import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import type { MouseEvent } from 'react';

import { activityWindow } from '../src/features/journal/activity.ts';
import {
  navigateAfterSettlingBrowserAutosaves,
  readAfterSettlingBrowserAutosaves,
} from '../src/features/journal/browser-autosaves.ts';
import type { ArchiveView } from '../src/features/journal/services/archive-fns.ts';
import type { SaveDraft } from '../src/features/journal/ui/use-autosave.ts';
import { ArchivePage } from './archive-navigation-archive-module.ts';
import { DayPage } from './archive-navigation-day-module.ts';
import type { ArchiveNavigationFixtureConfig } from './archive-navigation-fixture-contract.ts';
import { neverDownloads } from './archive-page-fixture-contract.ts';
import { journalEntryFromFixture } from './day-page-fixture-contract.ts';

type ArchiveNavigationDependencies = {
  readonly config: ArchiveNavigationFixtureConfig;
  readonly readArchive: () => Promise<ArchiveView>;
  readonly save: SaveDraft;
};

const navigationClass =
  'mx-auto flex w-full max-w-[76rem] justify-end px-5 pt-5 sm:px-8';
const queryClient = new QueryClient();

const FixtureShell = () => {
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const openArchive = async (
    event: MouseEvent<HTMLAnchorElement>,
  ): Promise<void> => {
    event.preventDefault();
    await navigateAfterSettlingBrowserAutosaves(() =>
      router.navigate({ to: '/archive' }),
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <nav aria-label="Journal sections" className={navigationClass}>
        <Link onClick={openArchive} preload={false} to="/archive">
          Open archive
        </Link>
      </nav>
      <main data-fixture-route={pathname}>
        <Outlet />
      </main>
    </QueryClientProvider>
  );
};

export const emptyArchiveView = (
  config: ArchiveNavigationFixtureConfig,
): ArchiveView => ({
  today: config.today,
  window: activityWindow(config.today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
  anniversaries: [],
});

export const createArchiveNavigationRouter = ({
  config,
  readArchive,
  save,
}: ArchiveNavigationDependencies) => {
  const rootRoute = createRootRoute({ component: FixtureShell });
  const dayRoute = createRoute({
    component: () => (
      <DayPage
        entry={journalEntryFromFixture(config.entry)}
        save={save}
        today={config.today}
      />
    ),
    getParentRoute: () => rootRoute,
    path: '/',
  });
  const archiveRoute = createRoute({
    component: () => (
      <ArchivePage
        download={neverDownloads}
        selectedYear={undefined}
        view={archiveRoute.useLoaderData()}
      />
    ),
    getParentRoute: () => rootRoute,
    loader: () => readAfterSettlingBrowserAutosaves(readArchive),
    path: '/archive',
  });

  return createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([dayRoute, archiveRoute]),
  });
};
