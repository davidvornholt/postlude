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
});

const decodeRows = Schema.decodeUnknownSync(Schema.Array(ProjectionRow));

type MigrationPool = ReturnType<typeof createPool>;

const backfillSearchDocuments = async (pool: MigrationPool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(`
      select
        entry_date as date,
        journal_markdown as "journalMarkdown",
        scripture_markdown as "scriptureMarkdown",
        scripture_book as "scriptureBook",
        scripture_chapter as "scriptureChapter",
        scripture_verse_start as "scriptureVerseStart",
        scripture_verse_end as "scriptureVerseEnd"
      from entry
      where journal_search_text is null
         or scripture_search_text is null
         or scripture_reference_search_text is null
      for update
    `);
    await Promise.all(
      decodeRows(result.rows).map((row) => {
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
        return client.query(
          `update entry
         set journal_search_text = $1,
             scripture_search_text = $2,
             scripture_reference_search_text = $3
         where entry_date = $4`,
          [
            document.journalText,
            document.scriptureText,
            document.scriptureReferenceText,
            row.date,
          ],
        );
      }),
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

export const migrateJournalDatabase = (pool: MigrationPool) =>
  migrateDatabase(pool, {
    afterTag: searchProjectionColumnsMigrationTag,
    run: backfillSearchDocuments,
  });
