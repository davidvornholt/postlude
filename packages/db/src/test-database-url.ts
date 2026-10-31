/**
 * The Postgres the tests in this package run against: `DATABASE_URL` when CI
 * sets it, otherwise the one in the generated `.env.local`. `bun test` skips
 * `.env.local`, so the file is read back through Bun's own env loader.
 */
const generatedEnvFile = new URL('../.env.local', import.meta.url).pathname;

export const databaseUrl = (): string => {
  const configured = globalThis.Bun.env.DATABASE_URL;
  if (configured !== undefined && configured !== '') {
    return configured;
  }
  const loaded = globalThis.Bun.spawnSync([
    'bun',
    `--env-file=${generatedEnvFile}`,
    '-e',
    'process.stdout.write(process.env.DATABASE_URL ?? "")',
  ]);
  const fromFile = loaded.exitCode === 0 ? loaded.stdout.toString() : '';
  if (fromFile === '') {
    throw new Error('DATABASE_URL is required for the database tests.');
  }
  return fromFile;
};
