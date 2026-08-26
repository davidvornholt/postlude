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
import { Data, Effect, type Exit } from 'effect';

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
const requireDatabaseUrl = (): string => {
  const configured = process.env.DATABASE_URL || fromGeneratedDevEnv();
  if (configured === '') {
    throw new Error(
      'No DATABASE_URL. These tests need a Postgres to run against: run `just dev-env-generate` and `just dev-db-start`, or set DATABASE_URL in the environment.',
    );
  }
  return configured;
};

/**
 * The pool type as `@postlude/db` hands it over, rather than as `pg` names it:
 * the package owns the driver, and naming it here would make this file a second
 * declared consumer of a dependency it only ever receives.
 */
export type TestPool = ReturnType<typeof createPool>;

/** Postgres' code for "that database already exists", which is not a failure. */
const duplicateDatabase = '42P04';

/**
 * A pool on a migrated test database, created if this is the first run. The
 * name cannot be a bound parameter, so it is quoted instead; it comes from
 * configuration rather than from input.
 */
export const openTestDatabase = async (): Promise<TestPool> => {
  const configured = new URL(requireDatabaseUrl());
  const name = `${configured.pathname.slice(1)}_test`;

  const admin = createPool(configured.toString());
  try {
    await admin.query(`create database "${name}"`);
  } catch (error) {
    if ((error as { readonly code?: string }).code !== duplicateDatabase) {
      throw error;
    }
  } finally {
    await admin.end();
  }

  const testUrl = new URL(configured.toString());
  testUrl.pathname = `/${name}`;
  const pool = createPool(testUrl.toString());
  await Effect.runPromise(migrateDatabase(pool));
  return pool;
};

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
