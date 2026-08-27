/** A bounded, ordered read of every currently meaningful journal day. */

import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import { journalReadError } from '../errors/journal-errors.ts';
import { type ExportEntry, ExportEntrySchema } from '../export-format.ts';
import type { JournalDate } from '../journal-day.ts';
import { EntryFromRow } from '../schemas/entry.ts';
import { currentMeaningfulEntry } from './entry-content-sql.ts';
import { inRepeatableReadSnapshot } from './read-snapshot.ts';

const TimestampTextRow = Schema.Struct({
  journalFirstUsedAt: Schema.propertySignature(
    Schema.NullOr(Schema.String),
  ).pipe(Schema.fromKey('journal_first_used_at_text')),
  scriptureFirstUsedAt: Schema.propertySignature(
    Schema.NullOr(Schema.String),
  ).pipe(Schema.fromKey('scripture_first_used_at_text')),
  createdAt: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('created_at_text'),
  ),
  updatedAt: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('updated_at_text'),
  ),
});

const CountRow = Schema.Struct({
  count: Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative()),
});

const decodeEntries = Schema.decodeUnknown(Schema.Array(EntryFromRow));
const decodeTimestampRows = Schema.decodeUnknown(
  Schema.Array(TimestampTextRow),
);
const decodeCounts = Schema.decodeUnknown(Schema.Array(CountRow));
const decodeExportEntries = Schema.decodeUnknown(
  Schema.Array(ExportEntrySchema),
);

export type { ExportEntry } from '../export-format.ts';

export type ExportPass<E, R> = {
  readonly before: Effect.Effect<void, E, R>;
  readonly onEntry: (entry: ExportEntry) => Effect.Effect<void, E, R>;
  readonly after: Effect.Effect<void, E, R>;
};

export type ExportVisitor<E, R> = {
  readonly onCount: (count: number) => Effect.Effect<void, E, R>;
  readonly passes: ReadonlyArray<ExportPass<E, R>>;
};

export const exportPageSize = 32;

export class EntryExport extends Effect.Service<EntryExport>()(
  'journal/EntryExport',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const meaningful = currentMeaningfulEntry(sql);

      const countEntries = () =>
        sql`
          select count(*)::text as count
          from entry
          where ${meaningful}
        `.pipe(
          Effect.flatMap(decodeCounts),
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.fail(new Error('The export count did not come back.'))
              : Effect.succeed(rows[0].count),
          ),
        );

      const pageAfter = (
        after: JournalDate | undefined,
        pageSize: number,
      ): Effect.Effect<ReadonlyArray<ExportEntry>, unknown> => {
        const afterEntry =
          after === undefined ? sql`` : sql`and entry_date > ${after}`;
        return sql`
          select
            entry_date,
            journal_markdown,
            journal_word_count,
            journal_first_used_at,
            to_char(
              journal_first_used_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) as journal_first_used_at_text,
            scripture_markdown,
            scripture_word_count,
            scripture_first_used_at,
            to_char(
              scripture_first_used_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) as scripture_first_used_at_text,
            scripture_book,
            scripture_chapter,
            scripture_verse_start,
            scripture_verse_end,
            created_at,
            to_char(
              created_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) as created_at_text,
            updated_at,
            to_char(
              updated_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) as updated_at_text
          from entry
          where ${meaningful} ${afterEntry}
          order by entry_date
          limit ${pageSize}
        `.pipe(
          Effect.flatMap((rows) =>
            Effect.all({
              entries: decodeEntries(rows),
              timestamps: decodeTimestampRows(rows),
            }),
          ),
          Effect.flatMap(({ entries, timestamps }) =>
            decodeExportEntries(
              entries.map((entry, index) => {
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
        );
      };

      const visit = <E, R>(
        visitor: ExportVisitor<E, R>,
        pageSize = exportPageSize,
      ): Effect.Effect<void, ReturnType<typeof journalReadError>, R> =>
        inRepeatableReadSnapshot(
          sql,
          Effect.gen(function* () {
            yield* visitor.onCount(yield* countEntries());
            for (const pass of visitor.passes) {
              yield* pass.before;
              let after: JournalDate | undefined;
              for (;;) {
                const entries = yield* pageAfter(after, pageSize);
                yield* Effect.forEach(entries, pass.onEntry, {
                  discard: true,
                });
                const last = entries.at(-1);
                if (last === undefined || entries.length < pageSize) {
                  break;
                }
                after = last.date;
              }
              yield* pass.after;
            }
          }),
        ).pipe(Effect.mapError(journalReadError));

      return { visit } as const;
    }),
  },
) {}
