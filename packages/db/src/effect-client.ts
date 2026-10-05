/**
 * The Effect SQL client, built from the connection string the app is
 * configured with.
 *
 * `@effect/sql-pg` speaks the PostgreSQL wire protocol itself and owns its own
 * connection pool, so this layer opens that pool when it is built and closes it
 * when its scope ends. It is separate from the `pg` pool `createPool` hands to
 * better-auth's Drizzle adapter, migrations, and scripts.
 */

import { PgClient } from '@effect/sql-pg';
import { type Layer, Redacted } from 'effect';
import type { SqlClient } from 'effect/sql/SqlClient';
import type { SqlError } from 'effect/sql/SqlError';

export const pgClientLayer = (
  connectionString: string,
): Layer.Layer<PgClient.PgClient | SqlClient, SqlError> =>
  PgClient.layer({ url: Redacted.make(connectionString) });
