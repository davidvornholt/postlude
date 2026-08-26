/** Run archive reads against one read-only Postgres snapshot. */

import type { SqlClient } from '@effect/sql';
import type { SqlError } from '@effect/sql/SqlError';
import { Effect } from 'effect';

export const inArchiveSnapshot = <A, E, R>(
  sql: SqlClient.SqlClient,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | SqlError, R> =>
  sql.withTransaction(
    sql`set transaction isolation level repeatable read read only`.pipe(
      Effect.zipRight(body),
    ),
  );
