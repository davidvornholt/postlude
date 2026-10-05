/** Run a multi-query read against one repeatable PostgreSQL snapshot. */

import { Effect, Option } from 'effect';
import type { SqlClient } from 'effect/sql';
import { SqlError, UnknownError } from 'effect/sql/SqlError';

export const inRepeatableReadSnapshot = <A, E, R>(
  sql: SqlClient.SqlClient,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | SqlError, R> =>
  Effect.gen(function* () {
    const transaction = yield* Effect.serviceOption(sql.transactionService);
    // Rollback-based tests already own a transaction. Reuse it only when it
    // gives this read the same snapshot guarantee as production.
    if (Option.isSome(transaction)) {
      const rows = yield* sql<{ readonly repeatableRead: boolean }>`
        select current_setting('transaction_isolation') = 'repeatable read'
          as "repeatableRead"
      `;
      if (rows[0]?.repeatableRead !== true) {
        return yield* Effect.fail(
          new SqlError({
            reason: new UnknownError({
              message:
                'A snapshot read nested inside a transaction requires repeatable-read isolation.',
              cause: rows[0],
            }),
          }),
        );
      }
      return yield* body;
    }
    return yield* sql.withTransaction(
      sql`set transaction isolation level repeatable read read only`.pipe(
        Effect.andThen(body),
      ),
    );
  });
