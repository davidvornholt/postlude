import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { build, createServer } from 'vite';
import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';

export type FixtureAssets = {
  readonly markup: string;
  readonly script: string;
  readonly styles: string;
};

const asText = (source: string | Uint8Array): string =>
  typeof source === 'string' ? source : new TextDecoder().decode(source);

const renderFixture = async (config: DayPageFixtureConfig): Promise<string> => {
  const server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins: [viteReact()],
    resolve: { tsconfigPaths: true },
    server: { middlewareMode: true },
  });
  try {
    const fixture = await server.ssrLoadModule(
      '/a11y/day-page-fixture-render.tsx',
    );
    if (typeof fixture.renderDayPageFixture !== 'function') {
      throw new Error('The day-page fixture has no server renderer.');
    }
    return await fixture.renderDayPageFixture(config);
  } finally {
    await server.close();
  }
};

export const buildDayPageFixture = async (
  config: DayPageFixtureConfig,
): Promise<FixtureAssets> => {
  const result = await build({
    build: {
      assetsInlineLimit: Number.POSITIVE_INFINITY,
      cssCodeSplit: false,
      lib: {
        entry: new URL('./day-page-fixture.tsx', import.meta.url).pathname,
        fileName: 'day-page-fixture',
        formats: ['es'],
      },
      minify: false,
      rollupOptions: { output: { codeSplitting: false } },
      write: false,
    },
    configFile: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    logLevel: 'silent',
    plugins: [tailwindcss(), viteReact()],
    resolve: { tsconfigPaths: true },
  });
  const results = Array.isArray(result) ? result : [result];
  const finished = results.filter((item) => 'output' in item);
  if (finished.length !== 1) {
    throw new Error('The day-page fixture did not produce one finished build.');
  }
  const output = finished[0]?.output ?? [];
  const script = output.find((item) => item.type === 'chunk')?.code;
  const stylesheet = output.find(
    (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
  );
  if (script === undefined || stylesheet?.type !== 'asset') {
    throw new Error('The day-page fixture produced no script or stylesheet.');
  }
  return {
    markup: await renderFixture(config),
    script,
    styles: asText(stylesheet.source),
  };
};
