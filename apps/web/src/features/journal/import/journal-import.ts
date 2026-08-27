import type { createPool } from '@postlude/db/pool';
import { Data, Effect } from 'effect';

import type {
  JournalImportIssue,
  JournalImportRecord,
} from './import-record.ts';
import {
  derivedImportFieldsOf,
  type ExistingJournalImportRow,
  existingImportRowIsUnchanged,
} from './journal-import-fields.ts';

type ImportPool = ReturnType<typeof createPool>;

export class JournalImportError extends Data.TaggedError('JournalImportError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type JournalImportSummary = {
  readonly inserted: number;
  readonly unchanged: number;
};

export const validateImportRecords = (
  records: ReadonlyArray<JournalImportRecord>,
  today: string,
): ReadonlyArray<JournalImportIssue> => {
  const sourcesByDate = new Map<string, Array<string>>();
  const issues: Array<JournalImportIssue> = [];
  for (const record of records) {
    const sources = sourcesByDate.get(record.date) ?? [];
    sources.push(record.source);
    sourcesByDate.set(record.date, sources);
    if (record.date > today) {
      issues.push({
        source: record.source,
        message: `Entry date ${record.date} is in the future.`,
      });
    }
  }
  for (const [date, sources] of sourcesByDate) {
    if (sources.length > 1) {
      issues.push({
        source: sources.join(', '),
        message: `Several source files claim ${date}.`,
      });
    }
  }
  return issues;
};

export const importJournalRecords = (
  pool: ImportPool,
  records: ReadonlyArray<JournalImportRecord>,
): Effect.Effect<JournalImportSummary, JournalImportError> =>
  Effect.tryPromise({
    try: async () => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const dates = records.map((record) => record.date);
        const existing = await client.query<ExistingJournalImportRow>(
          `select
             entry_date as date,
             journal_markdown as "journalMarkdown",
             journal_word_count as "journalWordCount",
             scripture_markdown as "scriptureMarkdown",
             scripture_word_count as "scriptureWordCount",
             scripture_book as "scriptureBook",
             scripture_chapter as "scriptureChapter",
             scripture_verse_start as "scriptureVerseStart",
             scripture_verse_end as "scriptureVerseEnd",
             revision,
             journal_search_text as "journalSearchText",
             scripture_search_text as "scriptureSearchText",
             scripture_reference_search_text as "scriptureReferenceSearchText",
             search_token_text as "searchTokenText",
             search_projection_revision as "searchProjectionRevision"
           from entry
           where entry_date = any($1::date[])
           for update`,
          [dates],
        );
        const existingByDate = new Map(
          existing.rows.map((row) => [row.date, row] as const),
        );
        const conflicts = records.filter((record) => {
          const row = existingByDate.get(record.date);
          return (
            row !== undefined && !existingImportRowIsUnchanged(row, record)
          );
        });
        if (conflicts.length > 0) {
          throw new JournalImportError({
            message: `Existing journal content conflicts on ${conflicts.map((record) => record.date).join(', ')}.`,
          });
        }

        const pending = records.filter(
          (record) => !existingByDate.has(record.date),
        );
        await Promise.all(
          pending.map((record) => {
            const { document, journalWordCount, scriptureWordCount } =
              derivedImportFieldsOf(record);
            return client.query(
              `insert into entry (
               entry_date,
               journal_markdown,
               journal_word_count,
               journal_first_used_at,
               scripture_markdown,
               scripture_word_count,
               scripture_first_used_at,
               scripture_book,
               scripture_chapter,
               scripture_verse_start,
               scripture_verse_end,
               revision,
               journal_search_text,
               scripture_search_text,
               scripture_reference_search_text,
               search_token_text,
               search_projection_revision
             ) values (
               $1::date, $2::text, $3::integer,
               case when $3::integer > 0 then now() else null end,
               $4::text, $5::integer,
               case when $5::integer > 0 or $6::text is not null then now() else null end,
               $6::text, $7::integer, $8::integer, $9::integer,
               1, $10::text, $11::text, $12::text, $13::text, 1
             )`,
              [
                record.date,
                record.journalMarkdown,
                journalWordCount,
                record.scriptureMarkdown,
                scriptureWordCount,
                record.scriptureReference?.book ?? null,
                record.scriptureReference?.chapter ?? null,
                record.scriptureReference?.verseStart ?? null,
                record.scriptureReference?.verseEnd ?? null,
                document.journalText,
                document.scriptureText,
                document.scriptureReferenceText,
                document.searchTokenText,
              ],
            );
          }),
        );
        await client.query('commit');
        return { inserted: pending.length, unchanged: existing.rows.length };
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    catch: (cause) =>
      cause instanceof JournalImportError
        ? cause
        : new JournalImportError({
            message: 'The journal import transaction failed.',
            cause,
          }),
  });
