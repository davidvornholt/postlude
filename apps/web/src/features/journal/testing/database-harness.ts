/**
 * One database, one pool, one Effect runtime, for whichever test file asks.
 *
 * The journal has two services over the same table — the repository that reads
 * and writes a day, and the search that reads the index — and each has its own
 * test file next to it. Both need the same setup: create and migrate the test
 * database, open a pool, build a runtime over it, and roll every test body back
 * so the journal is left exactly as it was found.
 *
 * That setup is a function a test file calls rather than a module that installs
 * itself on import. Bun caches a module across the files that import it, so
 * hooks registered at import time would attach to whichever file happened to
 * load it first and to no other. Calling `journalDatabase()` from the top of a
 * test file registers that file's own hooks.
 *
 * `shared/testing/test-database.ts` owns what the database itself is, and says
 * what these tests do and do not touch.
 */

import { afterAll, beforeAll } from 'bun:test';
import { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Exit, Layer, ManagedRuntime, Scope } from 'effect';

import {
  openTestDatabase,
  rolledBack,
} from '#/shared/testing/test-database.ts';
import type { EntryDraft } from '../schemas/entry.ts';
import { EntryExport } from '../services/entry-export.ts';
import { EntryRepository } from '../services/entry-repository.ts';
import { EntrySearch } from '../services/entry-search.ts';
import { migrateJournalDatabase } from '../services/journal-migration.ts';

type JournalServices =
  | EntryRepository
  | EntrySearch
  | EntryExport
  | SqlClient.SqlClient;

/** A day to store, with the parts a test does not care about left empty. */
export const draft = (
  date: string,
  journalMarkdown: string,
  scriptureReference = '',
): EntryDraft => ({
  date,
  journalMarkdown,
  scriptureMarkdown: '',
  scriptureReference,
});

export const journalDatabase = () => {
  let resourceScope: Scope.CloseableScope | undefined;
  let runtime: ManagedRuntime.ManagedRuntime<JournalServices, never>;

  const acquireResources = Effect.gen(function* () {
    const pool = yield* openTestDatabase(migrateJournalDatabase);
    const clientLayer = pgClientLayer(pool);
    const acquiredRuntime = ManagedRuntime.make(
      Layer.provideMerge(
        Layer.provide(
          Layer.mergeAll(
            EntryRepository.Default,
            EntrySearch.Default,
            EntryExport.Default,
          ),
          clientLayer,
        ),
        clientLayer,
      ).pipe(Layer.orDie),
    );
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => acquiredRuntime.dispose()),
    );
    return acquiredRuntime;
  });

  const openResources = Scope.make().pipe(
    Effect.flatMap((scope) =>
      acquireResources.pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.map((acquiredRuntime) => ({
          runtime: acquiredRuntime,
          scope,
        })),
        Effect.onError(() => Scope.close(scope, Exit.void)),
      ),
    ),
  );

  beforeAll(async () => {
    ({ runtime, scope: resourceScope } =
      await Effect.runPromise(openResources));
  });

  afterAll(async () => {
    if (resourceScope !== undefined) {
      await Effect.runPromise(Scope.close(resourceScope, Exit.void));
    }
  });

  /** Runs the body against a service and leaves the table as it was. */
  const withService =
    <S>(tag: Effect.Effect<S, never, JournalServices>) =>
    <A, E>(
      body: (service: S) => Effect.Effect<A, E, SqlClient.SqlClient>,
    ): Promise<A> =>
      runtime.runPromise(
        rolledBack(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`set transaction isolation level repeatable read`;
            const service = yield* tag;
            return yield* body(service);
          }),
        ),
      );

  return {
    withRepository: withService(EntryRepository),
    // Searching and exporting mean writing the days first, and a body that ran
    // outside the rollback would leave them behind, so the services that read
    // what the repository wrote are handed to one body along with it.
    withJournal: withService(
      Effect.all({
        entries: EntryRepository,
        search: EntrySearch,
        exports: EntryExport,
      }),
    ),
  } as const;
};
