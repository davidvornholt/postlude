import { expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { Effect } from 'effect';
import { acquireTestDatabase } from './test-database.ts';
import { TestDatabaseSetupError } from './test-database-errors.ts';

it('closes an acquired test pool when migration fails', async () => {
  type FakePool = { readonly connectionString: string };
  const closed: Array<string> = [];

  const error = await Effect.runPromise(
    Effect.scoped(
      acquireTestDatabase('postgres://localhost/postlude', {
        createPool: (connectionString): FakePool => ({ connectionString }),
        createDatabase: () => Promise.resolve(),
        migrateDatabase: () => Effect.fail(new Error('migration failed')),
        closePool: (pool) => {
          closed.push(pool.connectionString);
          return Promise.resolve();
        },
      }),
    ).pipe(Effect.flip),
  );

  expect(error).toBeInstanceOf(TestDatabaseSetupError);
  expect(closed).toEqual([
    'postgres://localhost/postlude',
    'postgres://localhost/postlude_test',
  ]);
});

// Playwright loads the browser database setup under Node, where `Bun` is not
// defined. Without DATABASE_URL the lookup falls back to the generated dev env
// file; it may find a URL or report the setup error, but it must not crash.
it('reads the generated dev env fallback under Node', () => {
  const { DATABASE_URL: _configured, ...environment } = process.env;
  const moduleUrl = new URL('test-database.ts', import.meta.url).href;
  const probe = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `const { configuredDatabaseUrl } = await import(${JSON.stringify(moduleUrl)});
const { Effect } = await import('effect');
process.stdout.write(Effect.runSync(Effect.either(configuredDatabaseUrl()))._tag);`,
    ],
    {
      cwd: new URL('../../..', import.meta.url).pathname,
      encoding: 'utf8',
      env: environment,
    },
  );

  expect(probe.stderr).toBe('');
  expect(['Left', 'Right']).toContain(probe.stdout);
});
