import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import type { InsightsPageFixtureWindow } from './insights-page-fixture-contract.ts';
import { InsightsPage } from './insights-page-fixture-module.ts';

const fixtureWindow = globalThis as unknown as InsightsPageFixtureWindow;
const config = fixtureWindow.postludeInsightsPageFixture;
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
  if (
    config.exportSettlement.outcome === 'failed' ||
    (config.exportSettlement.outcome === 'failed-once' && calls === 0)
  ) {
    documentElement.dataset.exportSettleStatus = 'failed';
    throw new TypeError('The fixture autosave failed.');
  }
  documentElement.dataset.exportSettleStatus = 'stored';
};
export const HydratedInsightsPage = () => {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return <InsightsPage settleAutosaves={settleAutosaves} view={config.view} />;
};

const router = createRenderingRouter(<HydratedInsightsPage />);
await router.load();

const root = document.querySelector('#insights-page-fixture');
if (root === null) {
  throw new Error('The insights-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
