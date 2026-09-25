import { expect, it } from 'bun:test';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Effect } from 'effect';
import type { Pool } from 'pg';

import {
  migrateDatabase,
  migrateGeneratedThrough,
  migrationFolder,
  searchEvidenceMigrationTag,
  searchProjectionColumnsMigrationTag,
} from './migrate.ts';
import { createPool } from './pool.ts';

const latestLegacyMigration = 2;
const expectedMigrationCount = 9;
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

const migrateTestDatabase = (pool: Pool) =>
  migrateDatabase(pool, [
    {
      afterTag: searchProjectionColumnsMigrationTag,
      run: (migrationPool) =>
        migrationPool
          .query(`
          update entry
          set journal_search_text = '',
              scripture_search_text = '',
              scripture_reference_search_text = '',
              search_token_text = '',
              search_projection_revision = revision
          where journal_search_text is null
             or scripture_search_text is null
             or scripture_reference_search_text is null
             or search_token_text is null
             or search_projection_revision is null
        `)
          .then(() => undefined),
    },
    {
      afterTag: searchEvidenceMigrationTag,
      run: async (migrationPool) => {
        await migrationPool.query(
          'update entry set search_evidence_revision = revision',
        );
      },
    },
  ]);

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
            yield* migrateTestDatabase(pool);
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
            yield* migrateTestDatabase(pool);
            expect(yield* Effect.promise(() => firstUseColumnCount(pool))).toBe(
              2,
            );
            expect(yield* Effect.promise(() => migrationCount(pool))).toBe(
              expectedMigrationCount,
            );
            yield* migrateTestDatabase(pool);
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

it('preserves legacy identities and accepts new provider-key accounts without issuer', async () => {
  await Effect.runPromise(
    withTemporaryDatabase(databaseUrl(), (pool) =>
      Effect.gen(function* () {
        yield* migrateGeneratedThrough(pool, '0007_bent_old_lace');
        yield* Effect.promise(() =>
          pool.query(`
      insert into "user" (id,name,email) values ('owner','Owner','owner@example.test');
      insert into account (id,issuer,account_id,provider_id,user_id)
      values ('legacy','https://github.com','123','github','owner');
    `),
        );
        yield* migrateTestDatabase(pool);
        const legacy = yield* Effect.promise(() =>
          pool.query(
            'select issuer,account_id as "accountId",provider_id as "providerId",user_id as "userId" from account where id=$1',
            ['legacy'],
          ),
        );
        expect(legacy.rows).toEqual([
          {
            issuer: 'https://github.com',
            accountId: '123',
            providerId: 'github',
            userId: 'owner',
          },
        ]);
        yield* Effect.promise(() =>
          pool.query(
            `insert into account (id,account_id,provider_id,user_id) values ('new','456','github','owner')`,
          ),
        );
        yield* Effect.promise(() =>
          pool.query(
            `insert into account (id,account_id,provider_id,user_id) values ('other-provider','123','other','owner')`,
          ),
        );
        yield* Effect.promise(async () =>
          expect(
            pool.query(
              `insert into account (id,account_id,provider_id,user_id) values ('duplicate','123','github','owner')`,
            ),
          ).rejects.toMatchObject({ code: '23505' }),
        );
        yield* migrateTestDatabase(pool);
        const count = yield* Effect.promise(() =>
          pool.query('select count(*)::integer as count from account'),
        );
        expect(count.rows).toEqual([{ count: 3 }]);
      }),
    ),
  );
});

it('refuses ambiguous legacy provider keys and rolls back the complete migration', async () => {
  await Effect.runPromise(
    withTemporaryDatabase(databaseUrl(), (pool) =>
      Effect.gen(function* () {
        yield* migrateGeneratedThrough(pool, '0007_bent_old_lace');
        yield* Effect.promise(() =>
          pool.query(`
      insert into "user" (id,name,email) values ('one','One','one@example.test'), ('two','Two','two@example.test');
      insert into account (id,issuer,account_id,provider_id,user_id)
      values ('one','https://one.example','123','github','one'), ('two','https://two.example','123','github','two');
    `),
        );
        const result = yield* Effect.either(migrateTestDatabase(pool));
        expect(result).toMatchObject({
          _tag: 'Left',
          left: { _tag: 'DatabaseMigrationError' },
        });
        const count = yield* Effect.promise(() =>
          pool.query('select count(*)::integer as count from account'),
        );
        expect(count.rows).toEqual([{ count: 2 }]);
        const column = yield* Effect.promise(() =>
          pool.query(
            `select is_nullable as "isNullable" from information_schema.columns where table_name='account' and column_name='issuer'`,
          ),
        );
        expect(column.rows).toEqual([{ isNullable: 'NO' }]);
        const index = yield* Effect.promise(() =>
          pool.query(
            `select indexname from pg_indexes where indexname='account_issuer_account_id_unique'`,
          ),
        );
        expect(index.rows).toHaveLength(1);
      }),
    ),
  );
});
