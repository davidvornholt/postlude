/** Validated, keyset-paged reads used by the journal export snapshot. */

import { Effect, Schema } from 'effect';
import type { SqlClient } from 'effect/sql';

import { journalReadError } from '../errors/journal-errors.ts';
import { ExportEntrySchema, UtcTimestampSchema } from '../export-format.ts';
import type { JournalDate } from '../journal-day.ts';
import { EntryFromRow, JournalDateSchema } from '../schemas/entry.ts';
import { exportableStoredEntry } from './entry-content-sql.ts';

const TimestampTextRow = Schema.Struct({
  journalFirstUsedAt: Schema.NullOr(Schema.String),
  scriptureFirstUsedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}).pipe(
  Schema.encodeKeys({
    journalFirstUsedAt: 'journal_first_used_at_text',
    scriptureFirstUsedAt: 'scripture_first_used_at_text',
    createdAt: 'created_at_text',
    updatedAt: 'updated_at_text',
  }),
);
const CountRow = Schema.Struct({
  count: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
});
const SnapshotRow = Schema.Struct({
  exportedAt: UtcTimestampSchema,
}).pipe(Schema.encodeKeys({ exportedAt: 'exported_at' }));
const DateRow = Schema.Struct({
  date: JournalDateSchema,
}).pipe(Schema.encodeKeys({ date: 'entry_date' }));

const decodeEntries = Schema.decodeUnknownEffect(Schema.Array(EntryFromRow));
const decodeTimestampRows = Schema.decodeUnknownEffect(
  Schema.Array(TimestampTextRow),
);
const decodeCounts = Schema.decodeUnknownEffect(Schema.Array(CountRow));
const decodeExportEntries = Schema.decodeUnknownEffect(
  Schema.Array(ExportEntrySchema),
);
const decodeSnapshotRows = Schema.decodeUnknownEffect(
  Schema.Array(SnapshotRow),
);
const decodeDateRows = Schema.decodeUnknownEffect(Schema.Array(DateRow));

export type ExportSnapshot = { readonly exportedAt: string };

export type ExportEntryPageOptions = {
  readonly after?: JournalDate;
  readonly from?: JournalDate;
  readonly to?: JournalDate;
  readonly pageSize: number;
};

export const makeEntryExportPages = (sql: SqlClient.SqlClient) => {
  const exportable = exportableStoredEntry(sql);
  const count = () =>
    sql`select count(*)::text as count from entry where ${exportable}`.pipe(
      Effect.flatMap(decodeCounts),
      Effect.flatMap((rows) =>
        rows[0] === undefined
          ? Effect.fail(new Error('The export count did not come back.'))
          : Effect.succeed(rows[0].count),
      ),
      Effect.mapError(journalReadError),
    );
  const snapshot = (): Effect.Effect<
    ExportSnapshot,
    ReturnType<typeof journalReadError>
  > =>
    sql`
      select to_char(
        statement_timestamp() at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ) as exported_at
    `.pipe(
      Effect.flatMap(decodeSnapshotRows),
      Effect.flatMap((rows) =>
        rows[0] === undefined
          ? Effect.fail(new Error('The export instant did not come back.'))
          : Effect.succeed(rows[0]),
      ),
      Effect.mapError(journalReadError),
    );
  const entries = ({ after, from, to, pageSize }: ExportEntryPageOptions) => {
    const afterEntry =
      after === undefined ? sql`` : sql`and entry_date > ${after}`;
    const fromEntry =
      from === undefined ? sql`` : sql`and entry_date >= ${from}`;
    const toEntry = to === undefined ? sql`` : sql`and entry_date <= ${to}`;
    return sql`
      select
        entry_date, journal_markdown, journal_word_count,
        journal_first_used_at,
        to_char(journal_first_used_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as journal_first_used_at_text,
        scripture_markdown, scripture_word_count, scripture_first_used_at,
        to_char(scripture_first_used_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as scripture_first_used_at_text,
        scripture_book, scripture_chapter, scripture_verse_start,
        scripture_verse_end, revision, created_at,
        to_char(created_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at_text,
        updated_at,
        to_char(updated_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at_text
      from entry
      where ${exportable} ${fromEntry} ${toEntry} ${afterEntry}
      order by entry_date
      limit ${pageSize}
    `.pipe(
      Effect.flatMap((rows) =>
        Effect.all({
          entries: decodeEntries(rows),
          timestamps: decodeTimestampRows(rows),
        }),
      ),
      Effect.flatMap(({ entries: rows, timestamps }) =>
        decodeExportEntries(
          rows.map((entry, index) => {
            const timestamp = timestamps[index];
            const reference = entry.scriptureReference;
            return {
              date: entry.date,
              journalMarkdown: entry.journalMarkdown,
              scriptureMarkdown: entry.scriptureMarkdown,
              scriptureReference:
                reference === undefined
                  ? null
                  : {
                      book: reference.book,
                      chapter: reference.chapter,
                      verseStart: reference.verseStart ?? null,
                      verseEnd: reference.verseEnd ?? null,
                    },
              journalFirstUsedAt: timestamp?.journalFirstUsedAt ?? null,
              scriptureFirstUsedAt: timestamp?.scriptureFirstUsedAt ?? null,
              createdAt: timestamp?.createdAt,
              updatedAt: timestamp?.updatedAt,
            };
          }),
        ),
      ),
      Effect.mapError(journalReadError),
    );
  };
  const dates = (after: JournalDate | undefined, pageSize: number) => {
    const afterEntry =
      after === undefined ? sql`` : sql`and entry_date > ${after}`;
    return sql`
      select entry_date from entry
      where ${exportable} ${afterEntry}
      order by entry_date
      limit ${pageSize}
    `.pipe(Effect.flatMap(decodeDateRows), Effect.mapError(journalReadError));
  };
  return { count, dates, entries, snapshot } as const;
};
