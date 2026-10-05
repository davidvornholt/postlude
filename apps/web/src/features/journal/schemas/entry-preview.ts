import { Schema, SchemaGetter } from 'effect';

import type { JournalDate } from '../journal-day.ts';
import type { ScriptureReference } from '../scripture-reference.ts';
import { JournalDateSchema, RevisionSchema, WordCountSchema } from './entry.ts';
import {
  hasCoherentScriptureReference,
  ScriptureReferenceSchema,
  scriptureReferenceOfRow,
  scriptureReferenceRowFields,
  scriptureReferenceRowKeys,
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
  date: JournalDateSchema,
  journalMarkdown: Schema.NullOr(Schema.String),
  journalWordCount: WordCountSchema,
  revision: RevisionSchema,
  scriptureMarkdown: Schema.NullOr(Schema.String),
  scriptureWordCount: WordCountSchema,
  ...scriptureReferenceRowFields,
})
  .pipe(
    Schema.encodeKeys({
      date: 'entry_date',
      journalMarkdown: 'journal_markdown',
      journalWordCount: 'journal_word_count',
      revision: 'revision',
      scriptureMarkdown: 'scripture_markdown',
      scriptureWordCount: 'scripture_word_count',
      ...scriptureReferenceRowKeys,
    }),
  )
  .check(
    Schema.makeFilter(hasCoherentScriptureReference, {
      identifier: 'CoherentScriptureReferenceColumns',
      description:
        'scripture reference columns that form an empty, chapter, verse, or verse-range reference',
    }),
  );

/** What a decoded row has become, held to `EntryPreview` by its annotation. */
const EntryPreviewSchema: Schema.Codec<EntryPreview> = Schema.Struct({
  date: Schema.String,
  journalMarkdown: Schema.String,
  journalWordCount: Schema.Number,
  revision: Schema.Number,
  scriptureMarkdown: Schema.String,
  scriptureReference: Schema.optionalKey(ScriptureReferenceSchema),
  scriptureWordCount: Schema.Number,
});

/** Decode-only: nothing writes a preview back through this shape. */
export const EntryPreviewFromRow = EntryPreviewRow.pipe(
  Schema.decodeTo(EntryPreviewSchema, {
    decode: SchemaGetter.transform((row) => {
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
    }),
    encode: SchemaGetter.forbiddenEncoding,
  }),
);
