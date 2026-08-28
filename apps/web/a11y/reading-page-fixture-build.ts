import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';
import type { ReadingPageFixtureConfig } from './reading-page-fixture-contract.ts';

export const buildReadingPageFixture = (
  config: ReadingPageFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL('./reading-page-fixture.tsx', import.meta.url)
      .pathname,
    serverModuleId: '/a11y/reading-page-fixture-render.tsx',
    serverRenderName: 'renderReadingPageFixture',
    replacements: [
      {
        fixtureModulePath: new URL(
          './calendar-page-fixture-module.ts',
          import.meta.url,
        ).pathname,
        productionModulePath: new URL(
          '../src/features/journal/ui/calendar-page.tsx',
          import.meta.url,
        ).pathname,
        exportNames: ['CalendarPage'],
      },
      {
        fixtureModulePath: new URL(
          './on-this-day-page-fixture-module.ts',
          import.meta.url,
        ).pathname,
        productionModulePath: new URL(
          '../src/features/journal/ui/on-this-day-page.tsx',
          import.meta.url,
        ).pathname,
        // biome-ignore lint/security/noSecrets: this is the exported React component name, not a credential.
        exportNames: ['OnThisDayPage'],
      },
    ],
  });
