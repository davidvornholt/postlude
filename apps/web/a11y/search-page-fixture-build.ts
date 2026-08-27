import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';
import type { SearchPageFixtureConfig } from './search-page-fixture-contract.ts';

const searchPageFixturePath = new URL(
  './search-page-fixture-module.ts',
  import.meta.url,
).pathname;
const searchPagePath = new URL(
  '../src/features/journal/ui/search-page.tsx',
  import.meta.url,
).pathname;
export const buildSearchPageFixture = (
  config: SearchPageFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL('./search-page-fixture.tsx', import.meta.url)
      .pathname,
    serverModuleId: '/a11y/search-page-fixture-render.tsx',
    serverRenderName: 'renderSearchPageFixture',
    replacements: [
      {
        fixtureModulePath: searchPageFixturePath,
        productionModulePath: searchPagePath,
        exportNames: ['SearchPage'],
      },
    ],
  });
