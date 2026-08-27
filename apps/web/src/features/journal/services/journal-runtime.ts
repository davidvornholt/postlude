/**
 * The one runtime the journal's server-side Effect code runs in, and the
 * boundary where an Effect becomes the promise the rest of the app speaks in.
 *
 * `AGENTS.local.md` describes this shape: journal services keep typed error and
 * requirement channels, while TanStack Start's server functions, React Query,
 * and components stay on plain promises. The two are joined in exactly one
 * place so a service never has to be unwrapped twice, and so the layers are
 * built once per process rather than per call.
 *
 * The runtime is created lazily. Building it opens the database pool and reads
 * the validated environment, and neither should happen because a module was
 * imported. The client bundle imports route modules that import services, and
 * a pool opened there would be a pool opened in a browser.
 */

import type { SqlError } from '@effect/sql/SqlError';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Cause, Effect, Layer, ManagedRuntime, Stream } from 'effect';

import { pool } from '#/shared/db/pool.ts';
import { EntryExport } from './entry-export.ts';
import { EntryRepository } from './entry-repository.ts';
import { EntrySearch } from './entry-search.ts';

const journalLayer = Layer.provide(
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
 * than at import, which is the point of building the runtime lazily. A database
 * that is down should fail the request that needed it, not the module that
 * mentioned it.
 */
type JournalRuntime = ManagedRuntime.ManagedRuntime<
  EntryRepository | EntrySearch | EntryExport,
  SqlError
>;

type JournalServices = EntryRepository | EntrySearch | EntryExport;

let runtime: JournalRuntime | undefined;

const journalRuntime = (): JournalRuntime => {
  const existing = runtime;
  if (existing !== undefined) {
    return existing;
  }
  const created: JournalRuntime = ManagedRuntime.make(journalLayer);
  runtime = created;
  return created;
};

/**
 * Runs a journal Effect on the server and hands back a promise.
 *
 * A declared failure is logged with its full cause on the server. `runPromise`
 * then rejects with an Effect FiberFailure, and TanStack Start's shallow error
 * serializer exposes only its safe message to the browser. It does not retain
 * the original error's `_tag` or database details. The current UI only branches
 * on success or failure, so that browser contract is sufficient.
 */
export const runJournalEffect = <A, E>(
  effect: Effect.Effect<A, E, JournalServices>,
): Promise<A> =>
  journalRuntime().runPromise(
    effect.pipe(
      Effect.tapErrorCause((cause) =>
        Effect.logError('A journal operation failed.', cause),
      ),
      Effect.tapDefect((defect) =>
        Effect.logError('A journal operation died.', Cause.die(defect)),
      ),
    ),
  );

/**
 * Gives an Effect stream the journal runtime without ending its scope when the
 * response is created. The runtime adapter drives one chunk per browser pull
 * and interrupts the stream fiber when the response body is cancelled.
 */
export const journalReadableStream = async <E>(
  stream: Stream.Stream<Uint8Array, E, JournalServices>,
): Promise<ReadableStream<Uint8Array>> => {
  const logged = stream.pipe(
    Stream.tapErrorCause((cause) =>
      Effect.logError('A journal stream failed.', cause),
    ),
  );
  return Stream.toReadableStreamRuntime(
    logged,
    await journalRuntime().runtime(),
  );
};
