import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Layer } from 'effect';

import {
  openTestDatabase,
  rolledBack,
} from '#/shared/testing/test-database.ts';
import type { EntryDraft } from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';

export const withRepository = <A, E>(
  body: (entries: EntryRepository) => Effect.Effect<A, E>,
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
        return yield* rolledBack(Effect.flatMap(EntryRepository, body)).pipe(
          Effect.provide(repositoryLayer),
        );
      }),
    ),
  );

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
