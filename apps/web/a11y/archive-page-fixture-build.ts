import type { ArchivePageFixtureConfig } from './archive-page-fixture-contract.ts';
import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';

const fixtureModulePath = new URL(
  './archive-page-fixture-module.ts',
  import.meta.url,
).pathname;
const productionModulePath = new URL(
  '../src/features/journal/ui/archive-page.tsx',
  import.meta.url,
).pathname;

export const buildArchivePageFixture = (
  config: ArchivePageFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL('./archive-page-fixture.tsx', import.meta.url)
      .pathname,
    serverModuleId: '/a11y/archive-page-fixture-render.tsx',
    serverRenderName: 'renderArchivePageFixture',
    replacements: [
      {
        fixtureModulePath,
        productionModulePath,
        exportNames: ['ArchivePage'],
      },
    ],
  });
