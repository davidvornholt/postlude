import { RouterProvider } from '@tanstack/react-router';
import { hydrateRoot } from 'react-dom/client';

import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import type { SearchPageFixtureWindow } from './search-page-fixture-contract.ts';
import { SearchPage } from './search-page-fixture-module.ts';
import { searchJournalFn } from './search-server-fixture-module.ts';

const fixtureWindow = globalThis as unknown as SearchPageFixtureWindow;
const config = fixtureWindow.postludeSearchPageFixture;
const router = createRenderingRouter(
  <SearchPage search={searchJournalFn} view={config.view} />,
);
await router.load();

const root = document.querySelector('#search-page-fixture');
if (root === null) {
  throw new Error('The search-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
document.documentElement.dataset.hydrated = 'true';
