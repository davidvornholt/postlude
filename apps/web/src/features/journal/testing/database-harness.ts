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
import type { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Layer, ManagedRuntime } from 'effect';

import {
  openTestDatabase,
  rolledBack,
  type TestPool,
} from '#/shared/testing/test-database.ts';
import type { EntryDraft } from '../schemas/entry.ts';
import { EntryRepository } from '../services/entry-repository.ts';
import { EntrySearch } from '../services/entry-search.ts';

type JournalServices = EntryRepository | EntrySearch | SqlClient.SqlClient;

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
  let pool: TestPool;
  let runtime: ManagedRuntime.ManagedRuntime<JournalServices, never>;

  beforeAll(async () => {
    pool = await openTestDatabase();
    const clientLayer = pgClientLayer(pool);
    runtime = ManagedRuntime.make(
      Layer.provideMerge(
        Layer.provide(
          Layer.mergeAll(EntryRepository.Default, EntrySearch.Default),
          clientLayer,
        ),
        clientLayer,
      ).pipe(Layer.orDie),
    );
  });

  afterAll(async () => {
    await runtime.dispose();
    await pool.end();
  });

  /** Runs the body against a service and leaves the table as it was. */
  const withService =
    <S>(tag: Effect.Effect<S, never, JournalServices>) =>
    <A, E>(body: (service: S) => Effect.Effect<A, E>): Promise<A> =>
      runtime.runPromise(rolledBack(Effect.flatMap(tag, body)));

  return {
    withRepository: withService(EntryRepository),
    // Searching means writing the days first, and a body that ran outside the
    // rollback would leave them behind, so both services are handed to one body.
    withJournal: withService(
      Effect.all({ entries: EntryRepository, search: EntrySearch }),
    ),
  } as const;
};
