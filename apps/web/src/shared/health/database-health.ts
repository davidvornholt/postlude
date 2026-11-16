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
 * allows the app's role (`@postlude/db/connections`). The timeout here only
 * makes sure the check cleans up; callers stop waiting at the same deadline
 * through `boundedAt`.
 */
export const databaseAnswers = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`select 1`;
}).pipe(
  Effect.timeoutOption(databaseHealthDeadlineMs),
  Effect.flatMap(
    Option.match({
      // The caller logs the timeout when it stops waiting.
      onNone: () => Effect.succeed(false),
      onSome: () => Effect.succeed(true),
    }),
  ),
  Effect.catchCause(() => logUnavailable('error').pipe(Effect.as(false))),
);

/**
 * Stops waiting for a check at the deadline. The check's own timeout cannot do
 * that: interrupting a query the database never answers waits for the driver
 * to cancel it, which takes several seconds more, so the answer is bounded here
 * and the check is left to clean up in the background.
 */
const boundedAt = (
  work: Promise<boolean>,
  onTimeout: () => void,
): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      onTimeout();
      resolve(false);
    }, databaseHealthDeadlineMs);
    work
      .then(resolve, () => resolve(false))
      .finally(() => {
        clearTimeout(timer);
      });
  });

/**
 * Concurrent calls share one query, so the public health route cannot fill the
 * app's small connection pool with health queries. The check stays shared until
 * it has cleaned up, even if callers stopped waiting for it, so a database that
 * hangs cannot pile up queries. A run that fails outright, such as a client
 * that cannot be built, counts as unavailable.
 */
export const makeDatabaseCheck = (
  run: (check: typeof databaseAnswers) => Promise<boolean>,
): (() => Promise<boolean>) => {
  let inFlight: { work: Promise<boolean>; timeoutLogged: boolean } | undefined;
  return () => {
    inFlight ??= {
      work: run(databaseAnswers)
        .catch(() => false)
        .finally(() => {
          inFlight = undefined;
        }),
      timeoutLogged: false,
    };
    const check = inFlight;
    return boundedAt(check.work, () => {
      if (!check.timeoutLogged) {
        check.timeoutLogged = true;
        Effect.runSync(logUnavailable('timeout'));
      }
    });
  };
};
