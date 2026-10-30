/**
 * What the database said when it refused a statement.
 *
 * The statement runs in a savepoint, so the refusal leaves the test's own
 * transaction usable for the next statement and for the rollback at its end.
 */

import { Effect, Predicate } from 'effect';
import type { SqlClient } from 'effect/sql';
import type { SqlError } from 'effect/sql/SqlError';

export type Refusal = {
  /** The SQLSTATE, such as `42501` for a missing privilege. */
  readonly code: string | undefined;
  readonly constraint: string | undefined;
};

const textProperty = (value: unknown, key: string): string | undefined =>
  Predicate.hasProperty(value, key) && Predicate.isString(value[key])
    ? value[key]
    : undefined;

export const refusalOf = <A, R>(
  sql: SqlClient.SqlClient,
  statement: Effect.Effect<A, SqlError, R>,
): Effect.Effect<Refusal, A, R> =>
  sql.withTransaction(statement).pipe(
    Effect.flip,
    Effect.map((error): Refusal => {
      const cause: unknown = error.reason.cause;
      return {
        code: textProperty(cause, 'code'),
        constraint: textProperty(cause, 'constraint'),
      };
    }),
  );
