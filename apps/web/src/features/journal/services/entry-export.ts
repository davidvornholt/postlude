/**
 * The whole journal, in one read, for taking out of the app.
 *
 * This is its own service for the same reason search is. `EntryRepository`
 * answers questions about a day — the row at this date, the days in this range,
 * the same date in earlier years — and every one of its reads is bounded by
 * something a page asked for. This read is bounded by nothing: it is the entire
 * table, in full, and it exists to be written to a file rather than to a page.
 * Keeping it apart is what stops an unbounded read from sitting one autocomplete
 * away from the calls a page makes.
 *
 * Nothing in here reads a clock, and nothing decides what a file looks like;
 * `export-archive.ts` owns that.
 */

import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import { journalReadError } from '../errors/journal-errors.ts';
import { EntryFromRow, type JournalEntry } from '../schemas/entry.ts';

const decodeEntries = Schema.decodeUnknown(Schema.Array(EntryFromRow));

export class EntryExport extends Effect.Service<EntryExport>()(
  'journal/EntryExport',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      /**
       * Every written day, oldest first. The order is the export's order, so the
       * files are written the way the journal was.
       */
      const readAll = (): Effect.Effect<
        ReadonlyArray<JournalEntry>,
        ReturnType<typeof journalReadError>
      > =>
        sql`
          select *
          from entry
          order by entry_date
        `.pipe(
          Effect.flatMap(decodeEntries),
          Effect.mapError(journalReadError),
        );

      return { readAll } as const;
    }),
  },
) {}
