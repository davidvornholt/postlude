import { Schema } from 'effect';

import { JournalDateSchema } from './entry.ts';

/**
 * One day as the archive needs it: enough to place a mark on the heatmap and to
 * decide a streak, and nothing else. The entry bodies are deliberately not here
 * — a year of them is a lot of prose to send in order to draw 365 squares.
 */
export const EntrySummaryFromRow = Schema.Struct({
  date: Schema.propertySignature(JournalDateSchema).pipe(
    Schema.fromKey('entry_date'),
  ),
  journalWordCount: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('journal_word_count'),
  ),
  journalFirstUsedAt: Schema.propertySignature(
    Schema.NullOr(Schema.ValidDateFromSelf),
  ).pipe(Schema.fromKey('journal_first_used_at')),
  scriptureWordCount: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('scripture_word_count'),
  ),
  scriptureFirstUsedAt: Schema.propertySignature(
    Schema.NullOr(Schema.ValidDateFromSelf),
  ).pipe(Schema.fromKey('scripture_first_used_at')),
  hasScriptureReference: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.fromKey('has_scripture_reference'),
  ),
});

export type EntrySummary = Schema.Schema.Type<typeof EntrySummaryFromRow>;
