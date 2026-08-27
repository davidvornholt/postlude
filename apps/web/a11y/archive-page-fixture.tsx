import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import type { ArchivePageFixtureWindow } from './archive-page-fixture-contract.ts';
import { ArchivePage } from './archive-page-fixture-module.ts';

const fixtureWindow = globalThis as unknown as ArchivePageFixtureWindow;
const config = fixtureWindow.postludeArchivePageFixture;
const settleAutosaves = async (): Promise<void> => {
  const { documentElement } = document;
  const calls = Number(documentElement.dataset.exportSettleCalls ?? '0');
  documentElement.dataset.exportSettleCalls = String(calls + 1);
  documentElement.dataset.exportSettleStatus = 'settling';
  if (config.exportSettlement.outcome === 'pending') {
    return new Promise<void>(() => undefined);
  }
  await new Promise((resolve) =>
    setTimeout(resolve, config.exportSettlement.delayMs),
  );
  if (config.exportSettlement.outcome === 'failed') {
    documentElement.dataset.exportSettleStatus = 'failed';
    throw new TypeError('The fixture autosave failed.');
  }
  documentElement.dataset.exportSettleStatus = 'stored';
};
export const HydratedArchivePage = () => {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return (
    <ArchivePage
      selectedYear={config.selectedYear}
      settleAutosaves={settleAutosaves}
      view={config.view}
    />
  );
};

const router = createRenderingRouter(<HydratedArchivePage />);
await router.load();

const root = document.querySelector('#archive-page-fixture');
if (root === null) {
  throw new Error('The archive-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
