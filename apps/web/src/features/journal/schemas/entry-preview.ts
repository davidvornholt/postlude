import { Schema } from 'effect';

import type { JournalDate } from '../journal-day.ts';
import type { ScriptureReference } from '../scripture-reference.ts';
import { JournalDateSchema, RevisionSchema, WordCountSchema } from './entry.ts';
import {
  hasCoherentScriptureReference,
  scriptureReferenceOfRow,
  scriptureReferenceRowFields,
} from './scripture-reference-row.ts';

export type EntryPreview = {
  readonly date: JournalDate;
  readonly journalMarkdown: string;
  readonly journalWordCount: number;
  readonly revision: number;
  readonly scriptureMarkdown: string;
  readonly scriptureReference?: ScriptureReference;
  readonly scriptureWordCount: number;
};

const EntryPreviewRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
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
  ...scriptureReferenceRowFields,
}).pipe(
  Schema.filter(hasCoherentScriptureReference, {
    identifier: 'CoherentScriptureReferenceColumns',
    description:
      'scripture reference columns that form an empty, chapter, verse, or verse-range reference',
  }),
);

export const EntryPreviewFromRow = Schema.transform(
  EntryPreviewRow,
  Schema.Any as Schema.Schema<EntryPreview>,
  {
    strict: false,
    decode: (row) => {
      const scriptureReference = scriptureReferenceOfRow(row);
      return {
        date: row.date,
        journalMarkdown: row.journalMarkdown ?? '',
        journalWordCount: row.journalWordCount,
        revision: row.revision,
        scriptureMarkdown: row.scriptureMarkdown ?? '',
        ...(scriptureReference === undefined ? {} : { scriptureReference }),
        scriptureWordCount: row.scriptureWordCount,
      };
    },
    encode: (entry) => entry,
  },
);
