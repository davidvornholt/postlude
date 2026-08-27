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
const writerDelaySeconds = 0.01;

const commitWriterUpdate = (pool: TestPool) =>
  Effect.tryPromise(async () => {
    const writer = await pool.connect();
    try {
      await writer.query('begin');
      await writer.query('select pg_sleep($1)', [writerDelaySeconds]);
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

const readExport = (exports: EntryExport, writerAfterSnapshot?: TestPool) =>
  Effect.gen(function* () {
    let exportedAt: string | undefined;
    let writerUpdatedAt: string | undefined;
    let included = false;

    yield* exports.visit({
      onSnapshot: ({ exportedAt: observedExportedAt }) =>
        Effect.gen(function* () {
          exportedAt = observedExportedAt;
          if (writerAfterSnapshot !== undefined) {
            writerUpdatedAt = yield* commitWriterUpdate(writerAfterSnapshot);
          }
        }),
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
    if (exportedAt === undefined) {
      return yield* Effect.dieMessage('The export instant was not observed.');
    }
    return { exportedAt, included, writerUpdatedAt };
  });

type WriterTiming = 'before-snapshot' | 'after-snapshot';

const observeWriterRace = (timing: WriterTiming) =>
  Effect.runPromise(
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
                Effect.zipRight(
                  timing === 'before-snapshot'
                    ? commitWriterUpdate(pool).pipe(
                        Effect.flatMap((writerUpdatedAt) =>
                          readExport(exports).pipe(
                            Effect.map((observed) => ({
                              ...observed,
                              writerUpdatedAt,
                            })),
                          ),
                        ),
                      )
                    : readExport(exports, pool),
                ),
              ),
            );
            if (snapshot.writerUpdatedAt === undefined) {
              return yield* Effect.dieMessage(
                'The writer update instant was not observed.',
              );
            }
            const committed = yield* entries.read(testDate);
            return {
              ...snapshot,
              writerUpdatedAt: snapshot.writerUpdatedAt,
              committed,
            };
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

it('includes a commit made after BEGIN but before the first entry read', async () => {
  const observed = await observeWriterRace('before-snapshot');

  expect(observed.included).toBe(true);
  expect(observed.exportedAt >= observed.writerUpdatedAt).toBe(true);
  expect(observed.committed?.journalMarkdown).toBe(committedMarkdown);
});

it('excludes a commit made after the first entry read began', async () => {
  const observed = await observeWriterRace('after-snapshot');

  expect(observed.included).toBe(false);
  expect(observed.writerUpdatedAt > observed.exportedAt).toBe(true);
  expect(observed.committed?.journalMarkdown).toBe(committedMarkdown);
  expect(observed.committed?.updatedAt.toISOString()).toBe(
    `${observed.writerUpdatedAt.slice(0, millisecondTimestampEnd)}Z`,
  );
});
