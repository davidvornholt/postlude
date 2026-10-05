/**
 * The server process's two database pools, both opened from `DATABASE_URL`
 * here; `@postlude/db/connections` says why there are two and how they are
 * sized.
 *
 * `pool` serves better-auth's Drizzle adapter. `sqlClientLayer` is the Effect
 * SQL client feature runtimes provide. `closeDatabase` closes both, and the
 * production server calls it once on shutdown, after the last request has
 * been answered.
 */

import type { PgClient } from '@effect/sql-pg';
import { createPool, pgClientLayer } from '@postlude/db/connections';
import { Effect, Layer, ManagedRuntime } from 'effect';
import type { SqlClient } from 'effect/sql/SqlClient';
import type { SqlError } from 'effect/sql/SqlError';

import { env } from '#/shared/env.ts';

export const pool = createPool(env.DATABASE_URL);

/**
 * The Effect client is built once, on first use, and shared by every runtime
 * that provides this layer, so a second feature runtime does not open a second
 * pool. Building it opens no connection, and nothing builds it before a
 * request needs the database.
 */
let sqlClient:
  | ManagedRuntime.ManagedRuntime<PgClient.PgClient | SqlClient, SqlError>
  | undefined;

export const sqlClientLayer: Layer.Layer<
  PgClient.PgClient | SqlClient,
  SqlError
> = Layer.effectContext(
  Effect.suspend(() => {
    sqlClient ??= ManagedRuntime.make(pgClientLayer(env.DATABASE_URL));
    return sqlClient.contextEffect;
  }),
);

export const closeDatabase = async (): Promise<void> => {
  await Promise.all([pool.end(), sqlClient?.dispose()]);
};
