import { expect, it } from 'bun:test';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Effect } from 'effect';
import type { Pool } from 'pg';

import { migrateDatabase, migrationFolder } from './migrate.ts';
import { createPool } from './pool.ts';

const latestLegacyMigration = 2;
const expectedMigrationCount = 4;
const testTimeoutMilliseconds = 30_000;
const generatedEnvFile = new URL('../.env.local', import.meta.url).pathname;

const databaseUrl = (): string => {
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
    throw new Error('DATABASE_URL is required for migration tests.');
  }
  return fromFile;
};

const closePool = (pool: Pool) =>
  Effect.promise(() => pool.end()).pipe(Effect.orDie);

const withTemporaryDatabase = <A, E>(
  configured: string,
  body: (pool: Pool) => Effect.Effect<A, E>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const admin = yield* Effect.acquireRelease(
        Effect.sync(() => createPool(configured)),
        closePool,
      );
      const name = `postlude_migration_${crypto.randomUUID().replaceAll('-', '')}`;
      yield* Effect.tryPromise(() => admin.query(`create database "${name}"`));
      const targetUrl = new URL(configured);
      targetUrl.pathname = `/${name}`;
      const target = yield* Effect.acquireRelease(
        Effect.sync(() => createPool(targetUrl.toString())),
        (pool) =>
          closePool(pool).pipe(
            Effect.andThen(
              Effect.promise(() =>
                admin.query(`drop database "${name}" with (force)`),
              ).pipe(Effect.orDie),
            ),
          ),
      );
      return yield* body(target);
    }),
  );

const migrateLegacyDatabase = (pool: Pool) => {
  const database = drizzle(pool);
  const migrations = readMigrationFiles({ migrationsFolder: migrationFolder });
  const session = database._.session as Parameters<PgDialect['migrate']>[1];
  return Effect.tryPromise(() =>
    new PgDialect().migrate(
      migrations.slice(0, latestLegacyMigration + 1),
      session,
      { migrationsFolder: migrationFolder },
    ),
  );
};

const legacySnapshots = async (pool: Pool): Promise<ReadonlyArray<string>> => {
  const result = await pool.query<{ readonly snapshot: string }>(`
    select to_jsonb(legacy)::text as snapshot
    from (
      select
        entry_date, journal_markdown, journal_word_count,
        scripture_markdown, scripture_word_count, scripture_book,
        scripture_chapter, scripture_verse_start, scripture_verse_end,
        created_at, updated_at, revision
      from entry
    ) legacy
    order by entry_date
  `);
  return result.rows.map((row) => row.snapshot);
};

const seedLegacyRows = (pool: Pool) =>
  Effect.tryPromise(() =>
    pool.query(`
      insert into entry (
        entry_date, journal_markdown, journal_word_count,
        scripture_markdown, scripture_word_count, scripture_book,
        scripture_chapter, scripture_verse_start, scripture_verse_end,
        created_at, updated_at, revision
      ) values
        ('2024-01-01', E'Exact journal. Grüße.\n\nSecond line.', 4, null, 0, null, null, null, null, '2024-01-02T03:04:05Z', '2024-02-03T04:05:06Z', 3),
        ('2024-01-02', null, 0, 'Scripture notes.', 2, null, null, null, null, '2024-01-03T03:04:05Z', '2024-02-04T04:05:06Z', 2),
        ('2024-01-03', '', 0, '', 0, 'Psalms', 23, null, null, '2024-01-04T03:04:05Z', '2024-02-05T04:05:06Z', 1),
        ('2024-01-04', null, 0, null, 0, null, null, null, null, '2024-01-05T03:04:05Z', '2024-02-06T04:05:06Z', 4)
    `),
  );

const migrationCount = async (pool: Pool): Promise<number> => {
  const result = await pool.query<{ readonly count: number }>(
    'select count(*)::integer as count from drizzle.__drizzle_migrations',
  );
  return result.rows[0]?.count ?? 0;
};

const firstUseColumnCount = async (pool: Pool): Promise<number> => {
  const result = await pool.query<{ readonly count: number }>(`
    select count(*)::integer as count
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entry'
      and column_name in ('journal_first_used_at', 'scripture_first_used_at')
  `);
  return result.rows[0]?.count ?? 0;
};

it(
  'preserves a 0002 database and keeps fresh migration runs idempotent',
  async () => {
    const configured = databaseUrl();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* withTemporaryDatabase(configured, (pool) =>
          Effect.gen(function* () {
            yield* migrateLegacyDatabase(pool);
            yield* seedLegacyRows(pool);
            const before = yield* Effect.promise(() => legacySnapshots(pool));
            yield* migrateDatabase(pool);
            const after = yield* Effect.promise(() => legacySnapshots(pool));
            const firstUse = yield* Effect.promise(() =>
              pool.query<{
                readonly journalFirstUsedAt: Date | null;
                readonly scriptureFirstUsedAt: Date | null;
              }>(`
                select
                  journal_first_used_at as "journalFirstUsedAt",
                  scripture_first_used_at as "scriptureFirstUsedAt"
                from entry
              `),
            );
            expect(after).toEqual(before);
            expect(
              firstUse.rows.every(
                (row) =>
                  row.journalFirstUsedAt === null &&
                  row.scriptureFirstUsedAt === null,
              ),
            ).toBe(true);
          }),
        );
        yield* withTemporaryDatabase(configured, (pool) =>
          Effect.gen(function* () {
            yield* migrateDatabase(pool);
            expect(yield* Effect.promise(() => firstUseColumnCount(pool))).toBe(
              2,
            );
            expect(yield* Effect.promise(() => migrationCount(pool))).toBe(
              expectedMigrationCount,
            );
            yield* migrateDatabase(pool);
            expect(yield* Effect.promise(() => migrationCount(pool))).toBe(
              expectedMigrationCount,
            );
          }),
        );
      }),
    );
  },
  testTimeoutMilliseconds,
);
