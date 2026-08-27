import type { ExportControlFixtureConfig } from './export-control-fixture-contract.ts';
import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';

const fixtureModulePath = new URL(
  './export-control-fixture-module.ts',
  import.meta.url,
).pathname;
const productionModulePath = new URL(
  '../src/features/journal/ui/export-control.tsx',
  import.meta.url,
).pathname;

export const buildExportControlFixture = (
  config: ExportControlFixtureConfig,
): Promise<FixtureAssets> =>
  buildHydratedFixture(config, {
    clientEntryPath: new URL('./export-control-fixture.tsx', import.meta.url)
      .pathname,
    serverModuleId: '/a11y/export-control-fixture-render.tsx',
    serverRenderName: 'renderExportControlFixture',
    replacements: [
      {
        fixtureModulePath,
        productionModulePath,
        exportNames: ['ExportControl'],
      },
    ],
  });
