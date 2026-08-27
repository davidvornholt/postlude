import { expect, it } from 'bun:test';
import { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@postlude/db/effect-client';
import { Effect, Layer } from 'effect';

import {
  openTestDatabase,
  type TestPool,
} from '#/shared/testing/test-database.ts';
import { draft } from '../testing/database-harness.ts';
import { EntryExport, type ExportEntry } from './entry-export.ts';
import { EntryRepository } from './entry-repository.ts';
import { migrateJournalDatabase } from './journal-migration.ts';

const testDate = '9090-04-03';

const commitWriterUpdate = (pool: TestPool) =>
  Effect.tryPromise(async () => {
    const writer = await pool.connect();
    try {
      await writer.query('begin');
      const result = await writer.query<{ readonly updatedAt: string }>(
        `update entry
         set
           journal_markdown = 'Committed after export BEGIN.',
           journal_word_count = 4,
           updated_at = statement_timestamp()
         where entry_date = $1
         returning to_char(
           updated_at at time zone 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
         ) as "updatedAt"`,
        [testDate],
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

const readExport = (exports: EntryExport) =>
  Effect.gen(function* () {
    let exportedAt: string | undefined;
    let entry: ExportEntry | undefined;
    yield* exports.visit({
      onSnapshot: ({ exportedAt: observedExportedAt }) =>
        Effect.sync(() => {
          exportedAt = observedExportedAt;
        }),
      onCount: () => Effect.void,
      passes: [
        {
          before: Effect.void,
          onEntry: (candidate) =>
            Effect.sync(() => {
              if (candidate.date === testDate) {
                entry = candidate;
              }
            }),
          after: Effect.void,
        },
      ],
    });
    if (exportedAt === undefined || entry === undefined) {
      return yield* Effect.dieMessage('The export missed its test row.');
    }
    return { entry, exportedAt };
  });

it('dates a snapshot after a writer committed between BEGIN and its first entry read', async () => {
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
            yield* entries.save(draft(testDate, 'Before export.'));
            let writerUpdatedAt: string | undefined;
            const rememberWriterUpdate = (updatedAt: string) =>
              Effect.sync(() => {
                writerUpdatedAt = updatedAt;
              });
            const snapshot = yield* sql.withTransaction(
              sql`set transaction isolation level repeatable read read only`.pipe(
                Effect.zipRight(
                  commitWriterUpdate(pool).pipe(
                    Effect.tap(rememberWriterUpdate),
                  ),
                ),
                Effect.zipRight(readExport(exports)),
              ),
            );
            if (writerUpdatedAt === undefined) {
              return yield* Effect.dieMessage(
                'The concurrent writer did not publish its update instant.',
              );
            }
            return { ...snapshot, writerUpdatedAt };
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

  expect(observed.entry.journalMarkdown).toBe('Committed after export BEGIN.');
  expect(observed.entry.updatedAt).toBe(observed.writerUpdatedAt);
  expect(observed.exportedAt >= observed.entry.updatedAt).toBe(true);
});
