import { expect, it } from 'bun:test';
import { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Layer } from 'effect';

import {
  openTestDatabase,
  type TestPool,
} from '#/shared/testing/test-database.ts';
import { draft } from '../testing/database-harness.ts';
import { EntryExport } from './entry-export.ts';
import { EntryRepository } from './entry-repository.ts';
import { migrateJournalDatabase } from './journal-migration.ts';

const testDate = '9090-04-03';
const committedMarkdown = 'Committed during the delayed export scan.';
const millisecondTimestampEnd = 23;

const commitWriterUpdate = (pool: TestPool) =>
  Effect.tryPromise(async () => {
    const writer = await pool.connect();
    try {
      await writer.query('begin');
      const result = await writer.query<{ readonly updatedAt: string }>(
        `update entry
         set
           journal_markdown = $2,
           journal_word_count = 6,
           updated_at = statement_timestamp()
         where entry_date = $1
         returning to_char(
           updated_at at time zone 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
         ) as "updatedAt"`,
        [testDate, committedMarkdown],
      );
      await writer.query('commit');
      const updatedAt = result.rows[0]?.updatedAt;
      if (updatedAt === undefined) {
        throw new Error('The concurrent writer did not update its test row.');
      }
      return updatedAt;
    } catch (error) {
      await writer.query('rollback');
      throw error;
    } finally {
      writer.release();
    }
  });

const readWhileWriterCommits = (exports: EntryExport, pool: TestPool) =>
  Effect.gen(function* () {
    let exportedAt: string | undefined;
    let writerUpdatedAt: string | undefined;
    let included = false;
    const commitAfterSnapshot = ({
      exportedAt: observedExportedAt,
    }: {
      readonly exportedAt: string;
    }) =>
      commitWriterUpdate(pool).pipe(
        Effect.tap((updatedAt) =>
          Effect.sync(() => {
            exportedAt = observedExportedAt;
            writerUpdatedAt = updatedAt;
          }),
        ),
      );

    yield* exports.visit({
      onSnapshot: commitAfterSnapshot,
      onCount: () => Effect.void,
      passes: [
        {
          before: Effect.void,
          onEntry: (entry) =>
            Effect.sync(() => {
              included ||= entry.date === testDate;
            }),
          after: Effect.void,
        },
      ],
    });
    if (exportedAt === undefined || writerUpdatedAt === undefined) {
      return yield* Effect.dieMessage(
        'The export did not observe both database instants.',
      );
    }
    return { exportedAt, included, writerUpdatedAt };
  });

it('excludes a commit made after the first entry read began', async () => {
  const observed = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const pool = yield* openTestDatabase(migrateJournalDatabase);
        const clientLayer = pgClientLayer(pool);
        const journalLayer = Layer.provideMerge(
          Layer.provide(
            Layer.merge(EntryRepository.Default, EntryExport.Default),
            clientLayer,
          ),
          clientLayer,
        ).pipe(Layer.orDie);

        return yield* Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const entries = yield* EntryRepository;
          const exports = yield* EntryExport;
          yield* sql`delete from entry where entry_date = ${testDate}`;
          return yield* Effect.gen(function* () {
            yield* entries.save(draft(testDate, ''));
            const snapshot = yield* sql.withTransaction(
              sql`set transaction isolation level repeatable read read only`.pipe(
                Effect.zipRight(readWhileWriterCommits(exports, pool)),
              ),
            );
            const committed = yield* entries.read(testDate);
            return { ...snapshot, committed };
          }).pipe(
            Effect.ensuring(
              sql`delete from entry where entry_date = ${testDate}`.pipe(
                Effect.orDie,
              ),
            ),
          );
        }).pipe(Effect.provide(journalLayer));
      }),
    ),
  );

  expect(observed.included).toBe(false);
  expect(observed.writerUpdatedAt > observed.exportedAt).toBe(true);
  expect(observed.committed?.journalMarkdown).toBe(committedMarkdown);
  expect(observed.committed?.updatedAt.toISOString()).toBe(
    `${observed.writerUpdatedAt.slice(0, millisecondTimestampEnd)}Z`,
  );
});
