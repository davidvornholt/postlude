import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

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
 *
 * The check constraints keep a partially filled reference out of the table: a
 * verse range with no book cannot be rendered or linked, so the database
 * refuses it rather than leaving the UI to guess. A book and a chapter are the
 * whole of what a reference needs — "Psalms 23" names a chapter and no verse in
 * it — so the verses are each optional above that floor, while a verse with no
 * chapter to sit in is refused. A book that is present but
 * holds no letter is refused for the same reason: it counts as filled in yet
 * renders as nothing a reader could recognise as a book. Every book name
 * carries letters, so requiring one also rejects a book built only from invisible
 * characters — a non-breaking space, a zero-width space, a soft hyphen — which
 * a whitespace-only test lets through because Postgres counts none of them as
 * `[:space:]`.
 *
 * Both timestamps carry the database clock's `now()`: `created_at` from its
 * column default, `updated_at` from the `now()` that Drizzle writes into every
 * update it issues. Neither reads an app process's clock, so the pair cannot
 * invert because a process disagrees with the database about the time.
 */
export const entry = pgTable(
  'entry',
  {
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
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    check(
      'entry_journal_word_count_non_negative',
      sql`${table.journalWordCount} >= 0`,
    ),
    check(
      'entry_scripture_word_count_non_negative',
      sql`${table.scriptureWordCount} >= 0`,
    ),
    check(
      'entry_scripture_reference_complete',
      sql`num_nonnulls(${table.scriptureBook}, ${table.scriptureChapter}) in (0, 2)`,
    ),
    check(
      'entry_scripture_verse_start_needs_chapter',
      sql`${table.scriptureVerseStart} is null or ${table.scriptureChapter} is not null`,
    ),
    check(
      'entry_scripture_verse_end_after_start',
      sql`${table.scriptureVerseEnd} is null or (${table.scriptureVerseStart} is not null and ${table.scriptureVerseEnd} >= ${table.scriptureVerseStart})`,
    ),
    check(
      'entry_scripture_chapter_positive',
      sql`${table.scriptureChapter} is null or ${table.scriptureChapter} >= 1`,
    ),
    check(
      'entry_scripture_verse_start_positive',
      sql`${table.scriptureVerseStart} is null or ${table.scriptureVerseStart} >= 1`,
    ),
    check(
      'entry_scripture_book_not_blank',
      sql`${table.scriptureBook} is null or ${table.scriptureBook} ~ '[[:alpha:]]'`,
    ),
  ],
);
