import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';
import type { InsightsPageFixtureConfig } from './insights-page-fixture-contract.ts';

const fixtureModulePath = new URL(
  './insights-page-fixture-module.ts',
  import.meta.url,
).pathname;
const productionModulePath = new URL(
  '../src/features/journal/ui/insights-page.tsx',
  import.meta.url,
).pathname;

export const buildInsightsPageFixture = (
  config: InsightsPageFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL('./insights-page-fixture.tsx', import.meta.url)
      .pathname,
    serverModuleId: '/a11y/insights-page-fixture-render.tsx',
    serverRenderName: 'renderInsightsPageFixture',
    replacements: [
      {
        fixtureModulePath,
        productionModulePath,
        exportNames: ['InsightsPage'],
      },
    ],
  });
