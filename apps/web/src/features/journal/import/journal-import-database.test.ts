import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import { openTestDatabase } from '#/shared/testing/test-database.ts';
import { migrateJournalDatabase } from '../services/journal-migration.ts';
import type { JournalImportRecord } from './import-record.ts';
import { importJournalRecords } from './journal-import.ts';

const firstDate = '1901-02-03';
const secondDate = '1901-02-04';

const record = (
  date: string,
  journalMarkdown: string,
): JournalImportRecord => ({
  date,
  journalMarkdown,
  scriptureMarkdown: 'Morning words.',
  scriptureReference: { book: 'Psalms', chapter: 23 },
  source: `${date}.md`,
});

it('commits once, accepts an exact rerun, and refuses the whole conflicting batch', async () => {
  const result = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const pool = yield* openTestDatabase(migrateJournalDatabase);
        const clean = Effect.promise(() =>
          pool.query('delete from entry where entry_date = any($1::date[])', [
            [firstDate, secondDate],
          ]),
        );
        return yield* Effect.gen(function* () {
          yield* clean;
          const imported = yield* importJournalRecords(pool, [
            record(firstDate, 'Imported evening words.'),
          ]);
          const rerun = yield* importJournalRecords(pool, [
            record(firstDate, 'Imported evening words.'),
          ]);
          yield* Effect.promise(() =>
            pool.query(
              `update entry
               set journal_word_count = 0,
                   scripture_search_text = ''
               where entry_date = $1::date`,
              [firstDate],
            ),
          );
          const corruptRerun = yield* Effect.exit(
            importJournalRecords(pool, [
              record(firstDate, 'Imported evening words.'),
            ]),
          );
          yield* clean;
          yield* importJournalRecords(pool, [
            record(firstDate, 'Imported evening words.'),
          ]);
          const conflict = yield* Effect.exit(
            importJournalRecords(pool, [
              record(secondDate, 'Must roll back.'),
              record(firstDate, 'Different existing prose.'),
            ]),
          );
          const rows = yield* Effect.promise(() =>
            pool.query<{
              readonly date: string;
              readonly journalWordCount: number;
              readonly scriptureBook: string | null;
              readonly revision: number;
              readonly searchProjectionRevision: number;
              readonly firstUsed: boolean;
            }>(
              `select
               entry_date as date,
               journal_word_count as "journalWordCount",
               scripture_book as "scriptureBook",
               revision,
               search_projection_revision as "searchProjectionRevision",
               journal_first_used_at is not null and
                 scripture_first_used_at is not null as "firstUsed"
             from entry
             where entry_date = any($1::date[])
               order by entry_date`,
              [[firstDate, secondDate]],
            ),
          );
          return { imported, rerun, corruptRerun, conflict, rows: rows.rows };
        }).pipe(Effect.ensuring(clean));
      }),
    ),
  );

  expect(result.imported).toEqual({ inserted: 1, unchanged: 0 });
  expect(result.rerun).toEqual({ inserted: 0, unchanged: 1 });
  expect(result.corruptRerun._tag).toBe('Failure');
  expect(result.conflict._tag).toBe('Failure');
  expect(result.rows).toEqual([
    {
      date: firstDate,
      journalWordCount: 3,
      scriptureBook: 'Psalms',
      revision: 1,
      searchProjectionRevision: 1,
      firstUsed: true,
    },
  ]);
});

it('holds matching rows against concurrent edits until the import commits', async () => {
  const result = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const pool = yield* openTestDatabase(migrateJournalDatabase);
        const clean = Effect.promise(() =>
          pool.query('delete from entry where entry_date = any($1::date[])', [
            [firstDate, secondDate],
          ]),
        );
        return yield* Effect.gen(function* () {
          yield* clean;
          yield* importJournalRecords(pool, [
            record(firstDate, 'Imported evening words.'),
          ]);

          return yield* Effect.promise(async () => {
            const selected = Promise.withResolvers<void>();
            const resume = Promise.withResolvers<void>();
            const lockingPool = new Proxy(pool, {
              get: (target, property) => {
                if (property !== 'connect') {
                  const value = Reflect.get(target, property, target);
                  return typeof value === 'function'
                    ? value.bind(target)
                    : value;
                }
                return async () => {
                  const client = await target.connect();
                  return new Proxy(client, {
                    get: (clientTarget, clientProperty) => {
                      if (clientProperty !== 'query') {
                        const value = Reflect.get(
                          clientTarget,
                          clientProperty,
                          clientTarget,
                        );
                        return typeof value === 'function'
                          ? value.bind(clientTarget)
                          : value;
                      }
                      return async (...args: ReadonlyArray<unknown>) => {
                        const query = String(args[0]);
                        const answer = await Reflect.apply(
                          clientTarget.query,
                          clientTarget,
                          args,
                        );
                        if (
                          query.includes('from entry') &&
                          query.includes('where entry_date = any')
                        ) {
                          selected.resolve();
                          await resume.promise;
                        }
                        return answer;
                      };
                    },
                  });
                };
              },
            });
            const importing = Effect.runPromise(
              importJournalRecords(lockingPool, [
                record(firstDate, 'Imported evening words.'),
                record(secondDate, 'Second imported evening.'),
              ]),
            );
            await selected.promise;

            const editor = await pool.connect();
            let editError: unknown;
            try {
              await editor.query("set lock_timeout = '100ms'");
              await editor.query(
                'update entry set journal_markdown = $1::text where entry_date = $2::date',
                ['Concurrent edit.', firstDate],
              );
            } catch (error) {
              editError = error;
            } finally {
              editor.release();
              resume.resolve();
            }
            const outcome = await importing;
            return { editError, outcome };
          });
        }).pipe(Effect.ensuring(clean));
      }),
    ),
  );

  expect(result.editError).toMatchObject({ code: '55P03' });
  expect(result.outcome).toEqual({ inserted: 1, unchanged: 1 });
});
