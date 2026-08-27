import type { Plugin } from 'vite';
import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';
import {
  type BrowserFixtureAssets,
  buildBrowserFixture,
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
      {
        fixtureModulePath,
        productionModulePath,
        exportNames: ['DayPage'],
      },
    ],
  });

const navigationFixtureModulePath = new URL(
  './day-navigation-fixture-module.ts',
  import.meta.url,
).pathname;
const appRoutePath = new URL('../src/routes/_app.tsx', import.meta.url)
  .pathname;
const stylesPath = new URL('../src/styles.css', import.meta.url).pathname;
const sessionFnPath = new URL(
  '../src/shared/auth/session-fn.ts',
  import.meta.url,
).pathname;
const archiveFunctionsPath = new URL(
  '../src/features/journal/services/archive-fns.ts',
  import.meta.url,
).pathname;

const navigationFixturePlugin = (): Plugin => ({
  name: 'postlude-day-navigation-fixture',
  load: (id) => {
    if (id === navigationFixtureModulePath) {
      return `import ${JSON.stringify(stylesPath)}; export { DayPage } from ${JSON.stringify(productionModulePath)}; import { Route } from ${JSON.stringify(appRoutePath)}; export const AppShell = Route.options.component;`;
    }
    if (id === sessionFnPath) {
      return 'export const hasAuthorizedSessionFn = () => Promise.resolve(true);';
    }
    return id === archiveFunctionsPath
      ? 'export const readArchiveFn = () => Promise.reject(new Error("The day navigation fixture has no archive route."));'
      : undefined;
  },
});

export const buildDayNavigationFixture = (): Promise<BrowserFixtureAssets> =>
  buildBrowserFixture({
    clientEntryPath: new URL('./day-navigation-fixture.tsx', import.meta.url)
      .pathname,
    plugins: [navigationFixturePlugin()],
  });
