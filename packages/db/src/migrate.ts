import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Data, Effect } from 'effect';
import type { Pool } from 'pg';

import migrationJournal from '../drizzle/meta/_journal.json' with {
  type: 'json',
};

export class DatabaseMigrationError extends Data.TaggedError(
  'DatabaseMigrationError',
)<{ readonly message: string; readonly cause: unknown }> {}

export const migrationFolder = decodeURIComponent(
  new URL('../drizzle', import.meta.url).pathname,
);

export const searchProjectionColumnsMigrationTag =
  '0004_charming_cassandra_nova';

export const searchEvidenceMigrationTag = '0006_mixed_prodigy';

export type ApplicationMigration = {
  readonly afterTag: string;
  readonly run: (pool: Pool) => Promise<void>;
};

const migrationsThrough = (tag: string) => {
  const index = migrationJournal.entries.findIndex(
    (entry) => entry.tag === tag,
  );
  if (index === -1) {
    throw new Error(`Unknown generated migration barrier: ${tag}`);
  }
  return readMigrationFiles({ migrationsFolder: migrationFolder }).slice(
    0,
    index + 1,
  );
};

const applyMigrations = async (
  pool: Pool,
  migrations: ReturnType<typeof readMigrationFiles>,
) => {
  const database = drizzle(pool);
  const session = database._.session as unknown as Parameters<
    PgDialect['migrate']
  >[1];
  await new PgDialect().migrate(migrations, session, {
    migrationsFolder: migrationFolder,
  });
};

/** Used by isolated upgrade tests to create the exact earlier schema. */
export const migrateGeneratedThrough = (pool: Pool, tag: string) =>
  Effect.tryPromise({
    try: () => applyMigrations(pool, migrationsThrough(tag)),
    catch: (cause) =>
      new DatabaseMigrationError({
        message: 'The generated Drizzle migrations failed.',
        cause,
      }),
  });

/** Applies generated DDL around the application-owned data transformation. */
export const migrateDatabase = (
  pool: Pool,
  applicationMigrations: ReadonlyArray<ApplicationMigration>,
) =>
  Effect.tryPromise({
    try: async () => {
      const migrations = readMigrationFiles({
        migrationsFolder: migrationFolder,
      });
      const applyNext = async (index: number, start: number): Promise<void> => {
        const migration = applicationMigrations[index];
        if (!migration) {
          await applyMigrations(pool, migrations.slice(start));
          return;
        }
        const barrier = migrationsThrough(migration.afterTag).length;
        if (barrier < start) {
          throw new Error('Application migration barriers must be ordered.');
        }
        await applyMigrations(pool, migrations.slice(start, barrier));
        await migration.run(pool);
        await applyNext(index + 1, barrier);
      };
      await applyNext(0, 0);
    },
    catch: (cause) =>
      new DatabaseMigrationError({
        message: 'The generated Drizzle migrations failed.',
        cause,
      }),
  });
