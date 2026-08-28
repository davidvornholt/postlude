import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import type { ReadingPageFixtureWindow } from './reading-page-fixture-contract.ts';
import { readingPageOf } from './reading-page-fixture-view.tsx';

const fixtureWindow = globalThis as unknown as ReadingPageFixtureWindow;

export const HydratedReadingPage = () => {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return readingPageOf(fixtureWindow.postludeReadingPageFixture);
};

const router = createRenderingRouter(<HydratedReadingPage />);
await router.load();

const root = document.querySelector('#reading-page-fixture');
if (root === null) {
  throw new Error('The reading-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
