import { expect, it } from 'bun:test';
import { Effect, Either } from 'effect';

import { draft, withRepository } from './entry-repository-test-support.ts';

it('rejects a stale base revision without replacing newer prose', async () => {
  const outcome = await withRepository((entries) =>
    Effect.gen(function* () {
      const first = yield* entries.save(draft('2026-08-25', 'First tab.'));
      const newer = yield* entries.save(
        draft('2026-08-25', 'Newer tab.', '', first.revision),
      );
      const conflict = yield* Effect.flip(
        entries.save(
          draft('2026-08-25', 'Stale tab prose.', '', first.revision),
        ),
      );
      const retained = yield* entries.read('2026-08-25');
      return { conflict, newer, retained } as const;
    }),
  );

  expect(outcome.conflict._tag).toBe('JournalWriteConflictError');
  expect(outcome.retained?.journalMarkdown).toBe('Newer tab.');
  expect(outcome.retained?.revision).toBe(outcome.newer.revision);
});

it('allows only one of two saves with the same base revision', async () => {
  const outcome = await withRepository((entries) =>
    Effect.gen(function* () {
      const first = yield* entries.save(draft('2026-08-25', 'First.'));
      const attempts = yield* Effect.all(
        ['Alpha.', 'Beta.'].map((prose) =>
          entries
            .save(draft('2026-08-25', prose, '', first.revision))
            .pipe(Effect.either),
        ),
        { concurrency: 'unbounded' },
      );
      const retained = yield* entries.read('2026-08-25');
      return { attempts, retained } as const;
    }),
  );
  const saved = outcome.attempts.filter(Either.isRight);
  const conflicts = outcome.attempts.filter(Either.isLeft);

  expect(saved).toHaveLength(1);
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0]?.left._tag).toBe('JournalWriteConflictError');
  expect(outcome.retained?.journalMarkdown).toBe(
    saved[0]?.right.journalMarkdown,
  );
  expect(outcome.retained?.revision).toBe(2);
});

it('rejects a nonzero base revision when the day does not exist', async () => {
  const nonexistentRevision = 7;
  const conflict = await withRepository((entries) =>
    Effect.flip(
      entries.save(
        draft('2026-08-25', 'No matching row.', '', nonexistentRevision),
      ),
    ),
  );

  expect(conflict._tag).toBe('JournalWriteConflictError');
});
