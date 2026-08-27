import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';
import {
  buildHydratedFixture,
  type FixtureAssets,
} from './hydrated-fixture-build.ts';

export type { FixtureAssets } from './hydrated-fixture-build.ts';

export type BrowserFixtureAssets = Omit<FixtureAssets, 'markup'>;

const asText = (source: string | Uint8Array): string =>
  typeof source === 'string' ? source : new TextDecoder().decode(source);

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

const navigationFixturePlugin = (): Plugin => ({
  name: 'postlude-day-navigation-fixture',
  load: (id) => {
    if (id === navigationFixtureModulePath) {
      return `import ${JSON.stringify(stylesPath)}; export { DayPage } from ${JSON.stringify(productionModulePath)}; import { Route } from ${JSON.stringify(appRoutePath)}; export const AppShell = Route.options.component;`;
    }
    return id === sessionFnPath
      ? 'export const hasAuthorizedSessionFn = () => Promise.resolve(true);'
      : undefined;
  },
});

export const buildDayNavigationFixture =
  async (): Promise<BrowserFixtureAssets> => {
    const result = await build({
      build: {
        assetsInlineLimit: Number.POSITIVE_INFINITY,
        cssCodeSplit: false,
        lib: {
          entry: new URL('./day-navigation-fixture.tsx', import.meta.url)
            .pathname,
          fileName: 'day-navigation-fixture',
          formats: ['es'],
        },
        minify: false,
        rollupOptions: { output: { codeSplitting: false } },
        write: false,
      },
      configFile: false,
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      logLevel: 'silent',
      plugins: [navigationFixturePlugin(), tailwindcss(), viteReact()],
      resolve: { tsconfigPaths: true },
    });
    const results = Array.isArray(result) ? result : [result];
    const output = results.find((item) => 'output' in item)?.output ?? [];
    const scriptOutput = output.find((item) => item.type === 'chunk');
    const script =
      scriptOutput?.type === 'chunk' ? scriptOutput.code : undefined;
    const stylesheet = output.find(
      (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
    );
    if (script === undefined || stylesheet?.type !== 'asset') {
      throw new Error(
        'The day-navigation fixture produced no script or stylesheet.',
      );
    }
    return { script, styles: asText(stylesheet.source) };
  };
