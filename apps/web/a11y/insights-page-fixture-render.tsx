import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import type { InsightsPageFixtureConfig } from './insights-page-fixture-contract.ts';
import { InsightsPage } from './insights-page-fixture-module.ts';

export const renderInsightsPageFixture = (
  config: InsightsPageFixtureConfig,
): Promise<string> =>
  renderInRouter(
    <InsightsPage
      settleAutosaves={() => Promise.resolve()}
      view={config.view}
    />,
  );
