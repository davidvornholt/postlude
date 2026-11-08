import { Schema } from 'effect';

import { JournalDateSchema, WordCountSchema } from './entry.ts';

/**
 * One day as Insights needs it: enough to place a mark on the year, to decide a
 * streak and to name the book read that morning, and nothing else. The entry
 * bodies are deliberately not here — a year of them is a lot of prose to send
 * in order to draw 365 squares.
 */
export const EntrySummaryFromRow = Schema.Struct({
  date: JournalDateSchema,
  journalWordCount: WordCountSchema,
  journalFirstUsedAt: Schema.NullOr(Schema.Date),
  scriptureWordCount: WordCountSchema,
  scriptureFirstUsedAt: Schema.NullOr(Schema.Date),
  /** Whether the morning noted a passage or a topic. */
  hasScripture: Schema.Boolean,
  scriptureBook: Schema.NullOr(Schema.String),
}).pipe(
  Schema.encodeKeys({
    date: 'entry_date',
    journalWordCount: 'journal_word_count',
    journalFirstUsedAt: 'journal_first_used_at',
    scriptureWordCount: 'scripture_word_count',
    scriptureFirstUsedAt: 'scripture_first_used_at',
    hasScripture: 'has_scripture',
    scriptureBook: 'scripture_book',
  }),
);

export type EntrySummary = Schema.Schema.Type<typeof EntrySummaryFromRow>;
