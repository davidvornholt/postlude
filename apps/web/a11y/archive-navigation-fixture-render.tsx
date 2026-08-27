import { RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

import type { ArchiveNavigationFixtureConfig } from './archive-navigation-fixture-contract.ts';
import {
  createArchiveNavigationRouter,
  emptyArchiveView,
} from './archive-navigation-router.tsx';

const neverSaves = () => new Promise<never>(() => undefined);

export const renderArchiveNavigationFixture = async (
  config: ArchiveNavigationFixtureConfig,
): Promise<string> => {
  const router = createArchiveNavigationRouter({
    config,
    readArchive: () => Promise.resolve(emptyArchiveView(config)),
    save: neverSaves,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
};
