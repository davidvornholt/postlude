import { describe, expect, it } from 'bun:test';

import {
  entryDocument,
  exportFileName,
  exportFiles,
} from './export-archive.ts';
import { emptyJournalEntry, type JournalEntry } from './schemas/entry.ts';

const today = '2026-08-26';
const chapter = 12;
const verseStart = 5;
const verseEnd = 13;
const readmeAndOne = 2;

const entry = (
  date: string,
  parts: Partial<JournalEntry> = {},
): JournalEntry => ({ ...emptyJournalEntry(date), ...parts });

const pathsOf = (files: ReadonlyArray<{ readonly path: string }>) =>
  files.map((file) => file.path);

describe('entryDocument', () => {
  it('opens with front matter carrying the journal day', () => {
    const document = entryDocument(
      entry('2026-03-01', { journalMarkdown: 'The rain fell all night.' }),
    );

    expect(document.startsWith('---\ndate: 2026-03-01\n---\n')).toBe(true);
  });

  it('writes the passage in the form the app reads back', () => {
    const document = entryDocument(
      entry('2026-03-01', {
        journalMarkdown: 'Evening.',
        scriptureReference: {
          book: 'Proverbs',
          chapter,
          verseStart,
          verseEnd,
        },
      }),
    );

    expect(document).toContain('scripture: Proverbs 12:5-13');
  });

  it('leaves the scripture line out when no passage was noted', () => {
    const document = entryDocument(
      entry('2026-03-01', { journalMarkdown: 'Evening.' }),
    );

    expect(document).not.toContain('scripture:');
  });

  it('holds both sections when both were written', () => {
    const document = entryDocument(
      entry('2026-03-01', {
        journalMarkdown: 'The rain fell all night.',
        scriptureMarkdown: 'A long look at the passage.',
      }),
    );

    expect(document).toContain('## Morning\n\nA long look at the passage.');
    expect(document).toContain('## Evening\n\nThe rain fell all night.');
  });

  it('leaves out a section that was never written', () => {
    const document = entryDocument(
      entry('2026-03-01', { journalMarkdown: 'The rain fell all night.' }),
    );

    expect(document).not.toContain('## Morning');
    expect(document).toContain('## Evening');
  });

  it('treats whitespace-only prose as unwritten', () => {
    const document = entryDocument(
      entry('2026-03-01', {
        journalMarkdown: 'Evening.',
        scriptureMarkdown: '   \n\n  ',
      }),
    );

    expect(document).not.toContain('## Morning');
  });

  it('ends with a single newline', () => {
    const document = entryDocument(
      entry('2026-03-01', { journalMarkdown: 'Evening.' }),
    );

    expect(document.endsWith('Evening.\n')).toBe(true);
  });
});

describe('exportFiles', () => {
  it('folders each day under its own year', () => {
    const files = exportFiles(
      [entry('2025-12-31'), entry('2026-01-01')],
      today,
    );

    expect(pathsOf(files)).toEqual([
      'README.md',
      '2025/2025-12-31.md',
      '2026/2026-01-01.md',
    ]);
  });

  it('keeps the days in the order they were given', () => {
    const files = exportFiles(
      [entry('2026-01-01'), entry('2026-01-02'), entry('2026-01-03')],
      today,
    );

    expect(pathsOf(files).slice(1)).toEqual([
      '2026/2026-01-01.md',
      '2026/2026-01-02.md',
      '2026/2026-01-03.md',
    ]);
  });

  it('explains the format inside the export', () => {
    const [readme] = exportFiles([entry('2026-01-01')], today);

    expect(readme?.text).toContain('Exported on 2026-08-26');
    expect(readme?.text).toContain('04:00');
    expect(readme?.text).toContain('Proverbs 12:5-13');
  });

  it('counts one day as a day rather than as days', () => {
    const [readme] = exportFiles([entry('2026-01-01')], today);

    expect(readme?.text).toContain('1 day,');
  });

  it('still explains itself when the journal is empty', () => {
    const files = exportFiles([], today);

    expect(pathsOf(files)).toEqual(['README.md']);
    expect(files[0]?.text).toContain('0 days');
  });

  it('carries each day as the document it is', () => {
    const day = entry('2026-01-01', { journalMarkdown: 'Evening.' });
    const files = exportFiles([day], today);

    expect(files.length).toBe(readmeAndOne);
    expect(files[1]?.text).toBe(entryDocument(day));
  });
});

describe('exportFileName', () => {
  it('dates the file so two exports never collide', () => {
    expect(exportFileName(today)).toBe('postlude-2026-08-26.zip');
  });
});
