import type { SqlClient } from '@effect/sql';

/** The stored sections that still give a journal day something to export. */
export const currentMeaningfulEntry = (sql: SqlClient.SqlClient) =>
  sql.or([
    sql`journal_word_count > 0`,
    sql`scripture_word_count > 0`,
    sql`scripture_book is not null`,
  ]);
