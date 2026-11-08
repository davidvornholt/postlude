import type { Plugin } from 'vite';
import {
  type BrowserFixtureAssets,
  buildBrowserFixture,
} from './hydrated-fixture-build.ts';

const dayModulePath = new URL(
  './insights-navigation-day-module.ts',
  import.meta.url,
).pathname;
const insightsModulePath = new URL(
  './insights-navigation-page-module.ts',
  import.meta.url,
).pathname;
const dayPagePath = new URL(
  '../src/features/journal/ui/day-page.tsx',
  import.meta.url,
).pathname;
const insightsPagePath = new URL(
  '../src/features/journal/ui/insights-page.tsx',
  import.meta.url,
).pathname;
const appRoutePath = new URL('../src/routes/_app.tsx', import.meta.url)
  .pathname;
const insightsFunctionsPath = new URL(
  '../src/features/journal/services/insights-fns.ts',
  import.meta.url,
).pathname;
const sessionFunctionPath = new URL(
  '../src/shared/auth/session-fn.ts',
  import.meta.url,
).pathname;
const stylesPath = new URL('../src/styles.css', import.meta.url).pathname;

const fixtureModules = (): Plugin => ({
  name: 'postlude-insights-navigation-fixture',
  load: (id) => {
    if (id === dayModulePath) {
      return `import ${JSON.stringify(stylesPath)}; export { DayPage } from ${JSON.stringify(dayPagePath)}; import { Route } from ${JSON.stringify(appRoutePath)}; export const AppShell = Route.options.component;`;
    }
    if (id === insightsModulePath) {
      return `export { InsightsPage } from ${JSON.stringify(insightsPagePath)};`;
    }
    if (id === sessionFunctionPath) {
      return 'export const hasAuthorizedSessionFn = () => Promise.resolve(true);';
    }
    return id === insightsFunctionsPath
      ? 'export const readInsightsFn = ({ data }) => globalThis.postludeInsightsNavigationRuntime.readInsights(data);'
      : undefined;
  },
});

export const buildInsightsNavigationFixture =
  (): Promise<BrowserFixtureAssets> =>
    buildBrowserFixture({
      clientEntryPath: new URL(
        './insights-navigation-fixture.tsx',
        import.meta.url,
      ).pathname,
      plugins: [fixtureModules()],
    });
