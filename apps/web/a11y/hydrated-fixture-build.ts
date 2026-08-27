import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { build, createServer, type Plugin } from 'vite';

export type FixtureAssets = {
  readonly markup: string;
  readonly script: string;
  readonly styles: string;
};

export type BrowserFixtureAssets = Omit<FixtureAssets, 'markup'>;

export type FixtureModuleReplacement = {
  readonly fixtureModulePath: string;
  readonly productionModulePath: string;
  readonly exportNames: ReadonlyArray<string>;
};

type HydratedFixtureOptions = {
  readonly clientEntryPath: string;
  readonly serverModuleId: string;
  readonly serverRenderName: string;
  readonly replacements: ReadonlyArray<FixtureModuleReplacement>;
};

const stylesPath = new URL('../src/styles.css', import.meta.url).pathname;

const fixtureModules = (
  replacements: ReadonlyArray<FixtureModuleReplacement>,
): Plugin => ({
  name: 'postlude-hydrated-fixture-modules',
  load: (id) => {
    const replacement = replacements.find(
      ({ fixtureModulePath }) => fixtureModulePath === id,
    );
    return replacement === undefined
      ? undefined
      : `import ${JSON.stringify(stylesPath)}; export { ${replacement.exportNames.join(', ')} } from ${JSON.stringify(replacement.productionModulePath)};`;
  },
});

const asText = (source: string | Uint8Array): string =>
  typeof source === 'string' ? source : new TextDecoder().decode(source);

export const buildBrowserFixture = async ({
  clientEntryPath,
  plugins = [],
}: {
  readonly clientEntryPath: string;
  readonly plugins?: ReadonlyArray<Plugin>;
}): Promise<BrowserFixtureAssets> => {
  const result = await build({
    build: {
      assetsInlineLimit: Number.POSITIVE_INFINITY,
      cssCodeSplit: false,
      lib: {
        entry: clientEntryPath,
        fileName: 'hydrated-fixture',
        formats: ['es'],
      },
      minify: false,
      rollupOptions: { output: { codeSplitting: false } },
      write: false,
    },
    configFile: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    logLevel: 'silent',
    plugins: [...plugins, tailwindcss(), viteReact()],
    resolve: { tsconfigPaths: true },
  });
  const results = Array.isArray(result) ? result : [result];
  const finished = results.filter((item) => 'output' in item);
  if (finished.length !== 1) {
    throw new Error('The browser fixture did not produce one finished build.');
  }
  const output = finished[0]?.output ?? [];
  const script = output.find((item) => item.type === 'chunk')?.code;
  const stylesheet = output.find(
    (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
  );
  if (script === undefined || stylesheet?.type !== 'asset') {
    throw new Error('The browser fixture produced no script or stylesheet.');
  }
  return { script, styles: asText(stylesheet.source) };
};

const renderFixture = async (
  config: unknown,
  options: HydratedFixtureOptions,
): Promise<string> => {
  const server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins: [fixtureModules(options.replacements), viteReact()],
    resolve: { tsconfigPaths: true },
    server: { middlewareMode: true },
  });
  try {
    const fixture = await server.ssrLoadModule(options.serverModuleId);
    const render = fixture[options.serverRenderName];
    if (typeof render !== 'function') {
      throw new Error('The hydrated fixture has no server renderer.');
    }
    return await render(config);
  } finally {
    await server.close();
  }
};

export const buildHydratedFixture = async (
  config: unknown,
  options: HydratedFixtureOptions,
): Promise<FixtureAssets> => {
  const browserAssets = await buildBrowserFixture({
    clientEntryPath: options.clientEntryPath,
    plugins: [fixtureModules(options.replacements)],
  });
  return {
    markup: await renderFixture(config, options),
    ...browserAssets,
  };
};
