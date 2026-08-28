import { Schema } from 'effect';

import type { JournalDate } from '../journal-day.ts';
import { JournalDateSchema, RevisionSchema, WordCountSchema } from './entry.ts';

export type EntryPreview = {
  readonly date: JournalDate;
  readonly hasScriptureReference: boolean;
  readonly journalMarkdown: string;
  readonly journalWordCount: number;
  readonly revision: number;
  readonly scriptureMarkdown: string;
  readonly scriptureWordCount: number;
};

const EntryPreviewRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  hasScriptureReference: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.fromKey('has_scripture_reference'),
  ),
  journalMarkdown: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('journal_markdown'),
  ),
  journalWordCount: Schema.propertySignature(WordCountSchema).pipe(
    Schema.fromKey('journal_word_count'),
  ),
  revision: Schema.propertySignature(RevisionSchema).pipe(
    Schema.fromKey('revision'),
  ),
  scriptureMarkdown: Schema.propertySignature(
    Schema.NullOr(Schema.String),
  ).pipe(Schema.fromKey('scripture_markdown')),
  scriptureWordCount: Schema.propertySignature(WordCountSchema).pipe(
    Schema.fromKey('scripture_word_count'),
  ),
});

export const EntryPreviewFromRow = Schema.transform(
  EntryPreviewRow,
  Schema.Any as Schema.Schema<EntryPreview>,
  {
    strict: false,
    decode: (row) => ({
      date: row.date,
      hasScriptureReference: row.hasScriptureReference,
      journalMarkdown: row.journalMarkdown ?? '',
      journalWordCount: row.journalWordCount,
      revision: row.revision,
      scriptureMarkdown: row.scriptureMarkdown ?? '',
      scriptureWordCount: row.scriptureWordCount,
    }),
    encode: (entry) => entry,
  },
);
