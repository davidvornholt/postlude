import { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Layer } from 'effect';

import {
  openTestDatabase,
  rolledBack,
} from '#/shared/testing/test-database.ts';
import type { EntryDraft } from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';

const runWithRepository = <A, E>(
  body: (entries: EntryRepository) => Effect.Effect<A, E, SqlClient.SqlClient>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const pool = yield* openTestDatabase();
        const clientLayer = pgClientLayer(pool);
        const repositoryLayer = Layer.provideMerge(
          Layer.provide(EntryRepository.Default, clientLayer),
          clientLayer,
        ).pipe(Layer.orDie);
        return yield* Effect.flatMap(EntryRepository, body).pipe(
          Effect.provide(repositoryLayer),
        );
      }),
    ),
  );

export const withRepository = <A, E>(
  body: (entries: EntryRepository) => Effect.Effect<A, E, SqlClient.SqlClient>,
): Promise<A> =>
  runWithRepository((entries) =>
    rolledBack(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`set transaction isolation level repeatable read`;
        return yield* body(entries);
      }),
    ),
  );

export const withCommittedRepository = runWithRepository;

export const draft = (
  date: string,
  journalMarkdown: string,
  scriptureReference = '',
  baseRevision = 0,
): EntryDraft => ({
  date,
  journalMarkdown,
  scriptureMarkdown: '',
  scriptureReference,
  baseRevision,
});
