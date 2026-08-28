import type { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import { journalReadError } from '../errors/journal-errors.ts';
import type { JournalDate } from '../journal-day.ts';
import { EarliestDateFromRow } from '../schemas/entry.ts';
import {
  type EntryPreview,
  EntryPreviewFromRow,
} from '../schemas/entry-preview.ts';
import { exportableStoredEntry } from './entry-content-sql.ts';
import { inRepeatableReadSnapshot } from './read-snapshot.ts';

const exactParseOptions = { onExcessProperty: 'error' } as const;
const decodeEntries = Schema.decodeUnknown(
  Schema.Array(EntryPreviewFromRow),
  exactParseOptions,
);
const decodeEarliestDates = Schema.decodeUnknown(
  Schema.Array(EarliestDateFromRow),
);

export type CalendarRead = {
  readonly earliest: JournalDate | undefined;
  readonly entries: ReadonlyArray<EntryPreview>;
};

export type CalendarReadRequest = {
  readonly from: JournalDate;
  readonly to: JournalDate;
  readonly today: JournalDate;
};

const earliestCalendarDate = (sql: SqlClient.SqlClient, today: JournalDate) =>
  sql`
    select min(entry_date) as entry_date
    from entry
    where ${exportableStoredEntry(sql)}
      and entry_date <= ${today}
  `.pipe(
    Effect.flatMap(decodeEarliestDates),
    Effect.map((rows) => rows[0]?.date ?? undefined),
  );

const listCalendarEntriesBetween = (
  sql: SqlClient.SqlClient,
  from: JournalDate,
  to: JournalDate,
) =>
  sql`
    select
      entry_date,
      scripture_book is not null as has_scripture_reference,
      journal_markdown,
      journal_word_count,
      revision,
      scripture_markdown,
      scripture_word_count
    from entry
    where entry_date between ${from} and ${to}
      and ${exportableStoredEntry(sql)}
    order by entry_date
  `.pipe(Effect.flatMap(decodeEntries));

export const makeCalendarReader =
  (sql: SqlClient.SqlClient) =>
  ({ from, to, today }: CalendarReadRequest) =>
    inRepeatableReadSnapshot(
      sql,
      Effect.gen(function* () {
        const earliest = yield* earliestCalendarDate(sql, today);
        const entries = yield* listCalendarEntriesBetween(sql, from, to);
        return { earliest, entries } satisfies CalendarRead;
      }),
    ).pipe(Effect.mapError(journalReadError));
