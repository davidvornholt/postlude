import { Effect, Option } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

/**
 * The host's start-up probe and the Docker healthcheck give each request five
 * seconds, so the check must answer well inside that, whether the database is
 * down or only slow.
 */
export const databaseHealthDeadlineMs = 1500;

type DatabaseUnavailableReason = 'error' | 'timeout';

// Only the reason, never the error: its message can carry connection details.
const logUnavailable = (reason: DatabaseUnavailableReason) =>
  Effect.logWarning(`Health check: database unavailable (${reason})`);

/**
 * Asks through the app's own SQL client, as every query of the app does. The
 * pool opens new connections by itself after an outage, so the app reports
 * itself healthy again without a restart. A connection of its own just for the
 * check would exceed the four connections a pull request preview's database
 * allows the app's role (`@postlude/db/connections`).
 */
export const databaseAnswers = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`select 1`;
}).pipe(
  Effect.timeoutOption(databaseHealthDeadlineMs),
  Effect.flatMap(
    Option.match({
      onNone: () => logUnavailable('timeout').pipe(Effect.as(false)),
      onSome: () => Effect.succeed(true),
    }),
  ),
  Effect.catchCause(() => logUnavailable('error').pipe(Effect.as(false))),
);

/**
 * Concurrent calls share one query, so the public health route cannot fill the
 * app's small connection pool with health queries. A run that fails outright,
 * such as a client that cannot be built, counts as unavailable.
 */
export const makeDatabaseCheck = (
  run: (check: typeof databaseAnswers) => Promise<boolean>,
): (() => Promise<boolean>) => {
  let inFlight: Promise<boolean> | undefined;
  return () => {
    inFlight ??= run(databaseAnswers)
      .catch(() => false)
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };
};
