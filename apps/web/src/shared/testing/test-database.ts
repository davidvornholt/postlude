/**
 * A real Postgres for the tests that need one, and a way to leave it exactly as
 * they found it.
 *
 * Some claims are only settled by the database: whether an upsert really
 * replaces a row, whether a DATE column comes back as the calendar date it was
 * written as, whether a check constraint accepts a value. Those tests run here
 * rather than against a stand-in.
 *
 * The database is the configured one with `_test` appended, created on demand
 * and migrated from the same generated migrations the app deploys. Nothing here
 * touches the journal you write in.
 */

import process from 'node:process';
import { SqlClient } from '@effect/sql';
import type { SqlError } from '@effect/sql/SqlError';
import { migrateDatabase } from '@postlude/db/migrate';
import { createPool } from '@postlude/db/pool';
import { Data, Effect, type Exit, type Scope } from 'effect';

import { TestDatabaseSetupError } from './test-database-errors.ts';

/**
 * `bun test` runs with `NODE_ENV=test`, and Bun deliberately skips `.env.local`
 * in that mode, so the generated dev environment is invisible to exactly the
 * tests that need it. CI hands `DATABASE_URL` to the job directly and never
 * reaches this path. Locally the value is read back through Bun's own env
 * loader — the same way the canonical justfile reads it — rather than by
 * parsing the file here, so what a generated env file means still has one
 * implementation.
 */
const generatedDevEnvFile = new URL('../../../.env.local', import.meta.url)
  .pathname;

const fromGeneratedDevEnv = (): string => {
  const loaded = Bun.spawnSync([
    'bun',
    `--env-file=${generatedDevEnvFile}`,
    '-e',
    'process.stdout.write(process.env.DATABASE_URL ?? "")',
  ]);
  return loaded.exitCode === 0 ? loaded.stdout.toString() : '';
};

/**
 * Missing configuration fails rather than skipping. A database test that
 * quietly does not run is a gate that quietly does not hold, and the two are
 * indistinguishable in a green build.
 */
const databaseUrl = (): Effect.Effect<string, TestDatabaseSetupError> => {
  const configured = process.env.DATABASE_URL || fromGeneratedDevEnv();
  if (configured === '') {
    return Effect.fail(
      new TestDatabaseSetupError({
        message:
          'No DATABASE_URL. These tests need a Postgres to run against: run `just dev-env-generate` and `just dev-db-start`, or set DATABASE_URL in the environment.',
        cause: 'DATABASE_URL is empty.',
      }),
    );
  }
  return Effect.succeed(configured);
};

/**
 * The pool type as `@postlude/db` hands it over, rather than as `pg` names it:
 * the package owns the driver, and naming it here would make this file a second
 * declared consumer of a dependency it only ever receives.
 */
export type TestPool = ReturnType<typeof createPool>;

/** Postgres' code for "that database already exists", which is not a failure. */
const duplicateDatabase = '42P04';

type TestDatabaseDependencies<Pool> = {
  readonly createPool: (connectionString: string) => Pool;
  readonly createDatabase: (pool: Pool, name: string) => Promise<unknown>;
  readonly migrateDatabase: (
    pool: Pool,
  ) => Effect.Effect<unknown, unknown, never>;
  readonly closePool: (pool: Pool) => Promise<unknown>;
};

const setupError = (cause: unknown): TestDatabaseSetupError =>
  new TestDatabaseSetupError({
    message: 'The test database could not be prepared.',
    cause,
  });

/**
 * The scoped acquisition behind `openTestDatabase`, exported so its failure
 * cleanup can be tested without opening a real connection.
 */
export const acquireTestDatabase = <Pool>(
  configured: string,
  dependencies: TestDatabaseDependencies<Pool>,
): Effect.Effect<Pool, TestDatabaseSetupError, Scope.Scope> =>
  Effect.gen(function* () {
    const configuredUrl = yield* Effect.try({
      try: () => new URL(configured),
      catch: setupError,
    });
    const name = `${configuredUrl.pathname.slice(1)}_test`;

    const acquirePool = (connectionString: string) =>
      Effect.acquireRelease(
        Effect.try({
          try: () => dependencies.createPool(connectionString),
          catch: setupError,
        }),
        (acquiredPool) =>
          Effect.tryPromise({
            try: () => dependencies.closePool(acquiredPool),
            catch: setupError,
          }).pipe(Effect.orDie),
      );

    yield* Effect.scoped(
      Effect.gen(function* () {
        const admin = yield* acquirePool(configuredUrl.toString());
        yield* Effect.tryPromise({
          try: () => dependencies.createDatabase(admin, name),
          catch: (cause) => cause,
        }).pipe(
          Effect.catchAll((cause) =>
            (cause as { readonly code?: string }).code === duplicateDatabase
              ? Effect.void
              : Effect.fail(cause),
          ),
          Effect.mapError(setupError),
        );
      }),
    );

    const testUrl = new URL(configuredUrl.toString());
    testUrl.pathname = `/${name}`;
    const pool = yield* acquirePool(testUrl.toString());
    yield* dependencies.migrateDatabase(pool).pipe(Effect.mapError(setupError));
    return pool;
  });

/**
 * A pool on a migrated test database, created if this is the first run. The
 * name cannot be a bound parameter, so it is quoted instead; it comes from
 * configuration rather than from input.
 */
export const openTestDatabase = (): Effect.Effect<
  TestPool,
  TestDatabaseSetupError,
  Scope.Scope
> =>
  databaseUrl().pipe(
    Effect.flatMap((configured) =>
      acquireTestDatabase(configured, {
        createPool,
        createDatabase: (pool, name) => pool.query(`create database "${name}"`),
        migrateDatabase,
        closePool: (pool) => pool.end(),
      }),
    ),
  );

class Rollback extends Data.TaggedError('Rollback')<{
  readonly outcome: Exit.Exit<unknown, unknown>;
}> {}

/**
 * Runs the body in a transaction and undoes it, so tests are independent of
 * each other and of the order they run in. The rollback is spelled as a
 * deliberate failure because that is how a transaction is undone in Effect; the
 * sentinel is caught again immediately.
 *
 * The body's own outcome is captured as an `Exit` before the sentinel is
 * raised, so what the transaction fails with is only ever the sentinel and a
 * body that failed still reports its own failure rather than the rollback. It
 * travels untyped because a tagged error cannot carry the caller's type
 * parameters; the signature restores them once, here.
 */
export const rolledBack = <A, E, R>(
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | SqlError, R | SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const outcome = yield* sql
      .withTransaction(
        Effect.exit(body).pipe(
          Effect.flatMap((exit) => new Rollback({ outcome: exit })),
        ),
      )
      .pipe(
        Effect.catchTag('Rollback', (rollback) =>
          Effect.succeed(rollback.outcome),
        ),
      );
    return yield* outcome as Exit.Exit<A, E>;
  });
