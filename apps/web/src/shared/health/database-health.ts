import { Effect, Option } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

/**
 * The host's start-up probe and the Docker healthcheck give each request five
 * seconds, so the check must answer well inside that, whether the database is
 * down or only slow.
 */
export const databaseHealthDeadlineMs = 1500;

type DatabaseUnavailableReason = 'error' | 'timeout';
type DatabaseState = 'available' | DatabaseUnavailableReason;

type InFlightCheck = {
  readonly state: Promise<DatabaseState>;
  reported: boolean;
};

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
  Effect.map(
    Option.match({
      onNone: (): DatabaseState => 'timeout',
      onSome: (): DatabaseState => 'available',
    }),
  ),
  Effect.catchCause(() => Effect.succeed<DatabaseState>('error')),
);

/**
 * Stops waiting for a check at the deadline. The check's own timeout cannot do
 * that: interrupting a query the database never answers waits for the driver
 * to cancel it, which takes several seconds more, so the answer is bounded here
 * and the check is left to clean up in the background.
 */
// Logs the reason once per check, whichever of the check or its caller sees it first.
const report = (check: InFlightCheck, reason: DatabaseUnavailableReason) => {
  if (!check.reported) {
    check.reported = true;
    Effect.runSync(logUnavailable(reason));
  }
};

const boundedAt = (check: InFlightCheck): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      report(check, 'timeout');
      resolve(false);
    }, databaseHealthDeadlineMs);
    check.state
      .then(
        (state) => resolve(state === 'available'),
        () => resolve(false),
      )
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
  let inFlight: InFlightCheck | undefined;
  return () => {
    if (inFlight === undefined) {
      const check: InFlightCheck = {
        reported: false,
        state: run(databaseAnswers)
          .catch((): DatabaseState => 'error')
          .finally(() => {
            inFlight = undefined;
          }),
      };
      check.state.then(
        (state) => {
          if (state !== 'available') {
            report(check, state);
          }
        },
        () => undefined,
      );
      inFlight = check;
    }
    return boundedAt(inFlight);
  };
};
