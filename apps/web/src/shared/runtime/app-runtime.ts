/**
 * The one runtime the server's Effect code runs in, and the boundary where an
 * Effect becomes the promise the rest of the app speaks in.
 *
 * `AGENTS.local.md` describes this shape: services keep typed error and
 * requirement channels, and everything above the boundary — TanStack Start's
 * server functions, React Query, the components — stays on plain promises. The
 * two are joined in exactly one place so a service never has to be unwrapped
 * twice, and so the layers are built once per process rather than per call.
 *
 * The runtime is created lazily. Building it opens the database pool and reads
 * the validated environment, and neither should happen because a module was
 * imported — the client bundle imports route modules that import services, and
 * a pool opened there would be a pool opened in a browser.
 */

import type { SqlError } from '@effect/sql/SqlError';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Cause, Effect, Layer, ManagedRuntime } from 'effect';

import { EntryExport } from '#/features/journal/services/entry-export.ts';
import { EntryRepository } from '#/features/journal/services/entry-repository.ts';
import { EntrySearch } from '#/features/journal/services/entry-search.ts';
import { pool } from '#/shared/db/pool.ts';

const appLayer = Layer.provide(
  Layer.mergeAll(
    EntryRepository.Default,
    EntrySearch.Default,
    EntryExport.Default,
  ),
  Layer.suspend(() => pgClientLayer(pool)),
);

/**
 * The layer can fail: acquiring the SQL client is itself an effect, and a pool
 * that cannot answer fails it. That failure surfaces on the first call rather
 * than at import, which is the point of building the runtime lazily — a
 * database that is down should fail the request that needed it, not the module
 * that mentioned it.
 */
type JournalServices = EntryRepository | EntrySearch | EntryExport;

type AppRuntime = ManagedRuntime.ManagedRuntime<JournalServices, SqlError>;

let runtime: AppRuntime | undefined;

const appRuntime = (): AppRuntime => {
  const existing = runtime;
  if (existing !== undefined) {
    return existing;
  }
  const created: AppRuntime = ManagedRuntime.make(appLayer);
  runtime = created;
  return created;
};

/**
 * Runs a server-side Effect and hands back a promise.
 *
 * A failure in the error channel is a typed error the caller declared, so it is
 * logged with its cause and then rethrown as itself: TanStack Start serialises
 * it to the client, where the `_tag` is what the UI branches on. The cause is
 * logged rather than sent, because what fails underneath a repository is a
 * database error carrying a statement and a connection string.
 */
export const runServerEffect = <A, E>(
  effect: Effect.Effect<A, E, JournalServices>,
): Promise<A> =>
  appRuntime().runPromise(
    effect.pipe(
      Effect.tapErrorCause((cause) =>
        Effect.logError('A journal operation failed.', cause),
      ),
      Effect.tapDefect((defect) =>
        Effect.logError('A journal operation died.', Cause.die(defect)),
      ),
    ),
  );
