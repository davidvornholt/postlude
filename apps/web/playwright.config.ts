import { readFileSync } from 'node:fs';
import process from 'node:process';
import { parseEnv } from 'node:util';
import { createA11yPlaywrightConfig } from '@davidvornholt/a11y-testing/playwright-config';
import { prepareBrowserDatabase } from './a11y/database';

const databaseUrl = await prepareBrowserDatabase();
Object.assign(
  process.env,
  parseEnv(readFileSync(new URL('./.env.a11y', import.meta.url), 'utf8')),
);
process.env.DATABASE_URL = databaseUrl;

const config = createA11yPlaywrightConfig({
  baseUrl: 'http://127.0.0.1:3100',
  webServerCommand: 'bun --env-file=.env.a11y run start',
});

// Fixture bundles are memory-intensive; bound local and CI browser concurrency.
export default { ...config, workers: 2 };
