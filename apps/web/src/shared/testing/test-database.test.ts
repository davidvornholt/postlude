import { expect, it } from 'bun:test';
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
