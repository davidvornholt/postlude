import {
  migrateDatabase,
  searchProjectionColumnsMigrationTag,
} from '@postlude/db/migrate';
import type { createPool } from '@postlude/db/pool';
import { Schema } from 'effect';

import { searchDocumentOf } from '../search-document.ts';

const ProjectionRow = Schema.Struct({
  date: Schema.String,
  journalMarkdown: Schema.NullOr(Schema.String),
  scriptureMarkdown: Schema.NullOr(Schema.String),
  scriptureBook: Schema.NullOr(Schema.String),
  scriptureChapter: Schema.NullOr(Schema.Number),
  scriptureVerseStart: Schema.NullOr(Schema.Number),
  scriptureVerseEnd: Schema.NullOr(Schema.Number),
  revision: Schema.Number,
});

const decodeRows = Schema.decodeUnknownSync(Schema.Array(ProjectionRow));

type MigrationPool = ReturnType<typeof createPool>;

export const searchBackfillBatchSize = 100;

const backfillSearchDocumentBatch = async (
  pool: MigrationPool,
): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
      select
        entry_date as date,
        journal_markdown as "journalMarkdown",
        scripture_markdown as "scriptureMarkdown",
        scripture_book as "scriptureBook",
        scripture_chapter as "scriptureChapter",
        scripture_verse_start as "scriptureVerseStart",
        scripture_verse_end as "scriptureVerseEnd",
        revision
      from entry
      where journal_search_text is null
         or scripture_search_text is null
         or scripture_reference_search_text is null
         or search_token_text is null
         or search_projection_revision is null
      order by entry_date
      limit $1
      for update
    `,
      [searchBackfillBatchSize],
    );
    const rows = decodeRows(result.rows);
    const updateRows = async (
      remaining: ReturnType<typeof decodeRows>,
    ): Promise<void> => {
      const [row, ...rest] = remaining;
      if (!row) {
        return;
      }
      const scriptureReference =
        row.scriptureBook === null || row.scriptureChapter === null
          ? undefined
          : {
              book: row.scriptureBook,
              chapter: row.scriptureChapter,
              ...(row.scriptureVerseStart === null
                ? {}
                : { verseStart: row.scriptureVerseStart }),
              ...(row.scriptureVerseEnd === null
                ? {}
                : { verseEnd: row.scriptureVerseEnd }),
            };
      const document = searchDocumentOf({
        journalMarkdown: row.journalMarkdown ?? '',
        scriptureMarkdown: row.scriptureMarkdown ?? '',
        scriptureReference,
      });
      await client.query(
        `update entry
         set journal_search_text = $1,
             scripture_search_text = $2,
             scripture_reference_search_text = $3,
             search_token_text = $4,
             search_projection_revision = $5
         where entry_date = $6
           and revision = $5`,
        [
          document.journalText,
          document.scriptureText,
          document.scriptureReferenceText,
          document.searchTokenText,
          row.revision,
          row.date,
        ],
      );
      await updateRows(rest);
    };
    await updateRows(rows);
    await client.query('commit');
    return rows.length;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

const backfillSearchDocuments = async (pool: MigrationPool): Promise<void> => {
  const count = await backfillSearchDocumentBatch(pool);
  if (count === searchBackfillBatchSize) {
    // A full batch may have another row behind it. The next ordered batch owns
    // a fresh transaction, so the migration never locks the whole journal.
    await backfillSearchDocuments(pool);
  }
};

export const migrateJournalDatabase = (pool: MigrationPool) =>
  migrateDatabase(pool, {
    afterTag: searchProjectionColumnsMigrationTag,
    run: backfillSearchDocuments,
  });
