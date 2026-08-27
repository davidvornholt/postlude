import { createPool } from '@postlude/db/pool';
import { Effect } from 'effect';
import { migrateJournalDatabase } from '../src/features/journal/services/journal-migration.ts';

const databaseUrl = Bun.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is not set.');
}

const migrationPool = createPool(databaseUrl);

await Effect.runPromise(
  migrateJournalDatabase(migrationPool).pipe(
    Effect.ensuring(Effect.promise(() => migrationPool.end())),
  ),
);
