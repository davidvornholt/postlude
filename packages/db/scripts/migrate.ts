import { Effect } from 'effect';

import { migrateDatabase } from '../src/migrate.ts';
import { createPool } from '../src/pool.ts';

const databaseUrl = Bun.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is not set.');
}

const migrationPool = createPool(databaseUrl);

await Effect.runPromise(
  migrateDatabase(migrationPool).pipe(
    Effect.ensuring(Effect.promise(() => migrationPool.end())),
  ),
);
