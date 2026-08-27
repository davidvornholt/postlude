import { Schema } from 'effect';

import type { JournalDate } from '../journal-day.ts';
import { JournalDateSchema, WordCountSchema } from './entry.ts';

export type AnniversaryEntry = {
  readonly date: JournalDate;
  readonly journalMarkdown: string;
  readonly journalWordCount: number;
  readonly scriptureMarkdown: string;
  readonly scriptureWordCount: number;
};

const AnniversaryEntryRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  journalMarkdown: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('journal_markdown'),
  ),
  journalWordCount: Schema.propertySignature(WordCountSchema).pipe(
    Schema.fromKey('journal_word_count'),
  ),
  scriptureMarkdown: Schema.propertySignature(
    Schema.NullOr(Schema.String),
  ).pipe(Schema.fromKey('scripture_markdown')),
  scriptureWordCount: Schema.propertySignature(WordCountSchema).pipe(
    Schema.fromKey('scripture_word_count'),
  ),
});

export const AnniversaryEntryFromRow = Schema.transform(
  AnniversaryEntryRow,
  Schema.Any as Schema.Schema<AnniversaryEntry>,
  {
    strict: false,
    decode: (row) => ({
      date: row.date,
      journalMarkdown: row.journalMarkdown ?? '',
      journalWordCount: row.journalWordCount,
      scriptureMarkdown: row.scriptureMarkdown ?? '',
      scriptureWordCount: row.scriptureWordCount,
    }),
    encode: (entry) => entry,
  },
);
