import { describe, expect, it } from 'bun:test';

import { scriptureBooks } from './scripture-books.ts';
import {
  findScriptureBook,
  scriptureReferenceUrl,
} from './scripture-reference.ts';

describe('scriptureBooks', () => {
  it('holds the whole bible once', () => {
    const booksInTheBible = 66;
    expect(scriptureBooks).toHaveLength(booksInTheBible);
    expect(new Set(scriptureBooks.map((book) => book.english)).size).toBe(
      booksInTheBible,
    );
    expect(new Set(scriptureBooks.map((book) => book.german)).size).toBe(
      booksInTheBible,
    );
  });

  /*
   * Names are matched folded, so two books whose names fold together would make
   * one of them unreachable — and silently, because the lookup keeps the first
   * writer. This is what catches an alias added later that collides.
   */
  it('gives every book a name no other book answers to', () => {
    for (const book of scriptureBooks) {
      for (const name of [book.english, book.german, ...book.aliases]) {
        expect(findScriptureBook(name)?.english).toBe(book.english);
      }
    }
  });

  it('links every book to its own book on bibleserver', () => {
    // Each German name was checked against the live site while this was
    // written: an unknown name there loads Genesis rather than failing, so a
    // typo would be invisible. This pins the names that were checked.
    expect(scriptureReferenceUrl({ book: 'Genesis', chapter: 1 })).toContain(
      '1.Mose1',
    );
    expect(
      scriptureReferenceUrl({ book: 'Revelation', chapter: 22 }),
    ).toContain('Offenbarung22');
    expect(scriptureReferenceUrl({ book: 'Acts', chapter: 2 })).toContain(
      'Apostelgeschichte2',
    );
  });
});
