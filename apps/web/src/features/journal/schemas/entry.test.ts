import { describe, expect, it } from 'bun:test';
import { Either, Schema } from 'effect';

import { EarliestDateFromRow, EntryFromRow } from './entry.ts';

const columnNames = {
  date: 'entry_date',
  journalMarkdown: 'journal_markdown',
  journalWordCount: 'journal_word_count',
  journalFirstUsedAt: 'journal_first_used_at',
  scriptureMarkdown: 'scripture_markdown',
  scriptureWordCount: 'scripture_word_count',
  scriptureFirstUsedAt: 'scripture_first_used_at',
  scriptureBook: 'scripture_book',
  scriptureChapter: 'scripture_chapter',
  scriptureVerseStart: 'scripture_verse_start',
  scriptureVerseEnd: 'scripture_verse_end',
  revision: 'revision',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

const baseRow = {
  date: '2026-08-25',
  journalMarkdown: null,
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: null,
  scriptureWordCount: 0,
  scriptureFirstUsedAt: null,
  scriptureBook: null,
  scriptureChapter: null,
  scriptureVerseStart: null,
  scriptureVerseEnd: null,
  revision: 1,
  createdAt: new Date('2026-08-25T12:00:00Z'),
  updatedAt: new Date('2026-08-25T12:00:00Z'),
};

const databaseRow = (columns: Readonly<Record<string, unknown>> = {}) => {
  const values = { ...baseRow, ...columns };
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      columnNames[name as keyof typeof columnNames],
      value,
    ]),
  );
};

const decodeEntry = Schema.decodeUnknownEither(EntryFromRow);
const decodeEntrySync = Schema.decodeUnknownSync(EntryFromRow);

describe('EntryFromRow', () => {
  it.each([
    { name: 'empty', columns: {}, reference: undefined },
    {
      name: 'a chapter',
      columns: { scriptureBook: 'Psalms', scriptureChapter: 23 },
      reference: { book: 'Psalms', chapter: 23 },
    },
    {
      name: 'a single verse',
      columns: {
        scriptureBook: 'Proverbs',
        scriptureChapter: 12,
        scriptureVerseStart: 5,
      },
      reference: { book: 'Proverbs', chapter: 12, verseStart: 5 },
    },
    {
      name: 'a verse range',
      columns: {
        scriptureBook: 'Proverbs',
        scriptureChapter: 12,
        scriptureVerseStart: 5,
        scriptureVerseEnd: 13,
      },
      reference: {
        book: 'Proverbs',
        chapter: 12,
        verseStart: 5,
        verseEnd: 13,
      },
    },
  ])('decodes $name reference', ({ columns, reference }) => {
    expect(decodeEntrySync(databaseRow(columns)).scriptureReference).toEqual(
      reference,
    );
  });

  it.each([
    {
      name: 'a book without a chapter',
      columns: { scriptureBook: 'Psalms' },
    },
    { name: 'a chapter without a book', columns: { scriptureChapter: 23 } },
    {
      name: 'a verse without a reference',
      columns: { scriptureVerseStart: 5 },
    },
    {
      name: 'an end verse without a start',
      columns: {
        scriptureBook: 'Proverbs',
        scriptureChapter: 12,
        scriptureVerseEnd: 13,
      },
    },
    {
      name: 'an inverted verse range',
      columns: {
        scriptureBook: 'Proverbs',
        scriptureChapter: 12,
        scriptureVerseStart: 13,
        scriptureVerseEnd: 5,
      },
    },
    {
      name: 'a non-positive chapter',
      columns: { scriptureBook: 'Psalms', scriptureChapter: 0 },
    },
    {
      name: 'a non-positive start verse',
      columns: {
        scriptureBook: 'Psalms',
        scriptureChapter: 23,
        scriptureVerseStart: 0,
      },
    },
    {
      name: 'a blank book',
      columns: { scriptureBook: '  ', scriptureChapter: 23 },
    },
    {
      name: 'a negative journal word count',
      columns: { journalWordCount: -1 },
    },
    {
      name: 'a negative scripture word count',
      columns: { scriptureWordCount: -1 },
    },
  ])('rejects $name', ({ columns }) => {
    expect(Either.isLeft(decodeEntry(databaseRow(columns)))).toBe(true);
  });
});

describe('EarliestDateFromRow', () => {
  const decode = Schema.decodeUnknownEither(EarliestDateFromRow);
  const aggregateRow = (date: unknown) => ({ [columnNames.date]: date });

  it('decodes a valid minimum and an empty-table null', () => {
    expect(decode(aggregateRow('2025-11-02'))).toEqual(
      Either.right({ date: '2025-11-02' }),
    );
    expect(decode(aggregateRow(null))).toEqual(Either.right({ date: null }));
  });

  it.each(['not-a-date', '2026-13-01', '2026-08-25T00:00:00Z'])(
    'rejects malformed driver value %s',
    (date) => {
      expect(Either.isLeft(decode(aggregateRow(date)))).toBe(true);
    },
  );
});
