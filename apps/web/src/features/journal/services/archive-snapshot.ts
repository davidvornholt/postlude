/** Run archive reads against one repeatable-read Postgres snapshot. */

import { SqlClient } from '@effect/sql';
import { SqlError } from '@effect/sql/SqlError';
import { Effect, Option } from 'effect';

export const inArchiveSnapshot = <A, E, R>(
  sql: SqlClient.SqlClient,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | SqlError, R> =>
  Effect.gen(function* () {
    const transaction = yield* Effect.serviceOption(
      SqlClient.TransactionConnection,
    );
    // A rollback-based caller may already own the transaction. Reuse it only
    // when it provides the same snapshot guarantee; never silently downgrade.
    if (Option.isSome(transaction)) {
      const rows = yield* sql<{ readonly repeatableRead: boolean }>`
        select current_setting('transaction_isolation') = 'repeatable read'
          as "repeatableRead"
      `;
      if (rows[0]?.repeatableRead !== true) {
        return yield* Effect.fail(
          new SqlError({
            message:
              'An archive read nested inside a transaction requires repeatable-read isolation.',
          }),
        );
      }
      return yield* body;
    }
    return yield* sql.withTransaction(
      sql`set transaction isolation level repeatable read read only`.pipe(
        Effect.zipRight(body),
      ),
    );
  });
