import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';
import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';

export type { FixtureAssets } from './hydrated-fixture-build.ts';

const fixtureModulePath = new URL(
  './day-page-fixture-module.ts',
  import.meta.url,
).pathname;
const productionModulePath = new URL(
  '../src/features/journal/ui/day-page.tsx',
  import.meta.url,
).pathname;

export const buildDayPageFixture = async (
  config: DayPageFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL('./day-page-fixture.tsx', import.meta.url)
      .pathname,
    serverModuleId: '/a11y/day-page-fixture-render.tsx',
    serverRenderName: 'renderDayPageFixture',
    replacements: [
      { fixtureModulePath, productionModulePath, exportName: 'DayPage' },
    ],
  });
