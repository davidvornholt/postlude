import type { ArchiveNavigationFixtureConfig } from './archive-navigation-fixture-contract.ts';
import {
  buildHydratedFixture,
  type FixtureAssets,
  type FixtureModuleReplacement,
} from './hydrated-fixture-build.ts';

const replacement = (
  fixture: string,
  production: string,
  exportName: string,
): FixtureModuleReplacement => ({
  fixtureModulePath: new URL(fixture, import.meta.url).pathname,
  productionModulePath: new URL(production, import.meta.url).pathname,
  exportName,
});

export const buildArchiveNavigationFixture = (
  config: ArchiveNavigationFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL(
      './archive-navigation-fixture.tsx',
      import.meta.url,
    ).pathname,
    serverModuleId: '/a11y/archive-navigation-fixture-render.tsx',
    serverRenderName: 'renderArchiveNavigationFixture',
    replacements: [
      replacement(
        './archive-navigation-day-module.ts',
        '../src/features/journal/ui/day-page.tsx',
        'DayPage',
      ),
      replacement(
        './archive-navigation-archive-module.ts',
        '../src/features/journal/ui/archive-page.tsx',
        'ArchivePage',
      ),
    ],
  });
