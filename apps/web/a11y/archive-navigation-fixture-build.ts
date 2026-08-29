import type { Plugin } from 'vite';
import {
  type BrowserFixtureAssets,
  buildBrowserFixture,
} from './hydrated-fixture-build.ts';

const dayModulePath = new URL(
  './archive-navigation-day-module.ts',
  import.meta.url,
).pathname;
const archiveModulePath = new URL(
  './archive-navigation-archive-module.ts',
  import.meta.url,
).pathname;
const dayPagePath = new URL(
  '../src/features/journal/ui/day-page.tsx',
  import.meta.url,
).pathname;
const archivePagePath = new URL(
  '../src/features/journal/ui/archive-page.tsx',
  import.meta.url,
).pathname;
const appRoutePath = new URL('../src/routes/_app.tsx', import.meta.url)
  .pathname;
const archiveFunctionsPath = new URL(
  '../src/features/journal/services/archive-fns.ts',
  import.meta.url,
).pathname;
const sessionFunctionPath = new URL(
  '../src/shared/auth/session-fn.ts',
  import.meta.url,
).pathname;
const stylesPath = new URL('../src/styles.css', import.meta.url).pathname;

const fixtureModules = (): Plugin => ({
  name: 'postlude-archive-navigation-fixture',
  load: (id) => {
    if (id === dayModulePath) {
      return `import ${JSON.stringify(stylesPath)}; export { DayPage } from ${JSON.stringify(dayPagePath)}; import { Route } from ${JSON.stringify(appRoutePath)}; export const AppShell = Route.options.component;`;
    }
    if (id === archiveModulePath) {
      return `export { ArchivePage } from ${JSON.stringify(archivePagePath)};`;
    }
    if (id === sessionFunctionPath) {
      return 'export const hasAuthorizedSessionFn = () => Promise.resolve(true);';
    }
    return id === archiveFunctionsPath
      ? 'export const readArchiveFn = ({ data }) => globalThis.postludeArchiveNavigationRuntime.readArchive(data.year);'
      : undefined;
  },
});

export const buildArchiveNavigationFixture =
  (): Promise<BrowserFixtureAssets> =>
    buildBrowserFixture({
      clientEntryPath: new URL(
        './archive-navigation-fixture.tsx',
        import.meta.url,
      ).pathname,
      plugins: [fixtureModules()],
    });
