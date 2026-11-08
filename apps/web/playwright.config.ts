import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
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
  baseUrl: 'http://127.0.0.1:3130',
  webServerCommand: 'bun --env-file=.env.a11y run start',
});

// The browser tests are independent and scale with cores, so run one worker
// per core. Each worker holds Vite, its fixture bundles and a browser, more
// than a gigabyte in all, so stop at eight on larger machines.
const maximumWorkers = 8;

// availableParallelism() sees CPU affinity but not a container's cgroup CPU
// quota, which would otherwise give a two-CPU container on a large host eight
// workers and exhaust its memory.
const cgroupCpuLimit = (): number => {
  try {
    const [quota = 'max', period = ''] = readFileSync(
      '/sys/fs/cgroup/cpu.max',
      'utf8',
    )
      .trim()
      .split(' ');
    const cores = Math.floor(Number(quota) / Number(period));
    return Number.isFinite(cores)
      ? Math.max(1, cores)
      : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export default {
  ...config,
  workers: Math.min(availableParallelism(), cgroupCpuLimit(), maximumWorkers),
};
