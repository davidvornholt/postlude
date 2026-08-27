import { RouterProvider } from '@tanstack/react-router';
import { hydrateRoot } from 'react-dom/client';

import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import {
  type ArchivePageFixtureWindow,
  neverDownloads,
} from './archive-page-fixture-contract.ts';
import { ArchivePage } from './archive-page-fixture-module.ts';

const fixtureWindow = globalThis as unknown as ArchivePageFixtureWindow;
const config = fixtureWindow.postludeArchivePageFixture;
const router = createRenderingRouter(
  <ArchivePage
    download={neverDownloads}
    selectedYear={config.selectedYear}
    view={config.view}
  />,
);
await router.load();

const root = document.querySelector('#archive-page-fixture');
if (root === null) {
  throw new Error('The archive-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
document.documentElement.dataset.hydrated = 'true';
