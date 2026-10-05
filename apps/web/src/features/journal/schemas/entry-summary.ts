import { Schema } from 'effect';

import { JournalDateSchema, WordCountSchema } from './entry.ts';

/**
 * One day as the archive needs it: enough to place a mark on the heatmap and to
 * decide a streak, and nothing else. The entry bodies are deliberately not here
 * — a year of them is a lot of prose to send in order to draw 365 squares.
 */
export const EntrySummaryFromRow = Schema.Struct({
  date: JournalDateSchema,
  journalWordCount: WordCountSchema,
  journalFirstUsedAt: Schema.NullOr(Schema.Date),
  scriptureWordCount: WordCountSchema,
  scriptureFirstUsedAt: Schema.NullOr(Schema.Date),
  hasScriptureReference: Schema.Boolean,
}).pipe(
  Schema.encodeKeys({
    date: 'entry_date',
    journalWordCount: 'journal_word_count',
    journalFirstUsedAt: 'journal_first_used_at',
    scriptureWordCount: 'scripture_word_count',
    scriptureFirstUsedAt: 'scripture_first_used_at',
    hasScriptureReference: 'has_scripture_reference',
  }),
);

export type EntrySummary = Schema.Schema.Type<typeof EntrySummaryFromRow>;
