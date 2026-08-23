import { date, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One row per journal day. A journal day runs 04:00–04:00 local time, so a
 * late-night session still belongs to the evening it closes out; the app
 * resolves the calendar date before it touches the database. The evening
 * journal prose and the optional morning scripture section share the row.
 *
 * The scripture reference is structured (book, chapter, verse range) so the
 * UI can render "Proverbs 12:5-13" and link to bibleserver.com without
 * parsing markdown. Word counts are persisted per section because the
 * archive heatmap buckets days by total words without loading entry bodies.
 */
export const entry = pgTable('entry', {
  entryDate: date('entry_date').primaryKey(),
  journalMarkdown: text('journal_markdown'),
  journalWordCount: integer('journal_word_count').notNull().default(0),
  scriptureMarkdown: text('scripture_markdown'),
  scriptureWordCount: integer('scripture_word_count').notNull().default(0),
  scriptureBook: text('scripture_book'),
  scriptureChapter: integer('scripture_chapter'),
  scriptureVerseStart: integer('scripture_verse_start'),
  scriptureVerseEnd: integer('scripture_verse_end'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
