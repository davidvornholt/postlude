import { describe, expect, it } from 'bun:test';

import {
  formatScriptureReference,
  parseScriptureReference,
  scriptureReferenceUrl,
} from './scripture-reference.ts';

describe('parseScriptureReference', () => {
  it('reads the house style the app writes', () => {
    expect(parseScriptureReference('Proverbs 12:5-13')).toEqual({
      book: 'Proverbs',
      chapter: 12,
      verseStart: 5,
      verseEnd: 13,
    });
  });

  it('reads a single verse and a whole chapter', () => {
    expect(parseScriptureReference('Proverbs 12:5')).toEqual({
      book: 'Proverbs',
      chapter: 12,
      verseStart: 5,
    });
    expect(parseScriptureReference('Psalms 23')).toEqual({
      book: 'Psalms',
      chapter: 23,
    });
  });

  /*
   * The writer reads a German bible and types at an English interface, so both
   * conventions arrive: German separates chapter from verse with a comma and
   * names the book in German.
   */
  it('reads a German reference as the same thing', () => {
    expect(parseScriptureReference('Sprüche 12,5-13')).toEqual({
      book: 'Proverbs',
      chapter: 12,
      verseStart: 5,
      verseEnd: 13,
    });
    expect(parseScriptureReference('Spr 12,5-13')).toEqual(
      parseScriptureReference('Proverbs 12:5-13'),
    );
    // Typed without the umlaut, as an English keyboard reaches it.
    expect(parseScriptureReference('Sprueche 12,5')).toEqual({
      book: 'Proverbs',
      chapter: 12,
      verseStart: 5,
    });
  });

  it('keeps a leading number with the book and not with the chapter', () => {
    expect(parseScriptureReference('1 Kings 3:5')).toEqual({
      book: '1 Kings',
      chapter: 3,
      verseStart: 5,
    });
    expect(parseScriptureReference('1.Korinther 13,4-7')).toEqual({
      book: '1 Corinthians',
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
    });
    expect(parseScriptureReference('1Cor 13:4')).toEqual({
      book: '1 Corinthians',
      chapter: 13,
      verseStart: 4,
    });
  });

  it('accepts the dashes a keyboard and an autocorrect produce', () => {
    const hyphen = parseScriptureReference('Proverbs 12:5-13');
    expect(parseScriptureReference('Proverbs 12:5–13')).toEqual(hyphen);
    expect(parseScriptureReference('Proverbs 12:5—13')).toEqual(hyphen);
  });

  it('collapses a range that names one verse twice', () => {
    expect(parseScriptureReference('Proverbs 12:5-5')).toEqual({
      book: 'Proverbs',
      chapter: 12,
      verseStart: 5,
    });
  });

  it('refuses what is not a reference', () => {
    // Mid-sentence and partway typed are the states the writer is in most of
    // the time, and neither is an error.
    expect(parseScriptureReference('')).toBeUndefined();
    expect(parseScriptureReference('Proverbs')).toBeUndefined();
    expect(parseScriptureReference('12:5-13')).toBeUndefined();
    expect(parseScriptureReference('It was a quiet morning')).toBeUndefined();
    // Not a book of the bible.
    expect(parseScriptureReference('Hesiod 12:5')).toBeUndefined();
    // A range that ends before it starts is a typo.
    expect(parseScriptureReference('Proverbs 12:13-5')).toBeUndefined();
    // Chapter and verse are counted from one.
    expect(parseScriptureReference('Proverbs 0:5')).toBeUndefined();
    expect(parseScriptureReference('Proverbs 12:0')).toBeUndefined();
  });
});

describe('formatScriptureReference', () => {
  it('writes one house style whatever was typed', () => {
    for (const typed of [
      'Proverbs 12:5-13',
      'Sprüche 12,5-13',
      'spr 12 , 5 - 13',
      '  Proverbs   12:5–13  ',
    ]) {
      const reference = parseScriptureReference(typed);
      expect(reference).toBeDefined();
      expect(reference && formatScriptureReference(reference)).toBe(
        'Proverbs 12:5-13',
      );
    }
  });

  it('drops the parts a reference does not have', () => {
    expect(
      formatScriptureReference({
        book: 'Proverbs',
        chapter: 12,
        verseStart: 5,
      }),
    ).toBe('Proverbs 12:5');
    expect(formatScriptureReference({ book: 'Psalms', chapter: 23 })).toBe(
      'Psalms 23',
    );
  });

  it('round-trips everything it writes', () => {
    for (const reference of [
      { book: 'Psalms', chapter: 23 },
      { book: '1 Corinthians', chapter: 13, verseStart: 4 },
      { book: 'Song of Songs', chapter: 2, verseStart: 10, verseEnd: 13 },
    ]) {
      expect(
        parseScriptureReference(formatScriptureReference(reference)),
      ).toEqual(reference);
    }
  });
});

describe('scriptureReferenceUrl', () => {
  /*
   * bibleserver addresses books by their German names and separates the verse
   * range with a comma. The translation itself carries a character that has to
   * be encoded, so a URL built by hand would be wrong before the book name even
   * arrived.
   */
  it('opens the passage in the NeÜ', () => {
    expect(
      scriptureReferenceUrl({
        book: 'Proverbs',
        chapter: 12,
        verseStart: 5,
        verseEnd: 13,
      }),
    ).toBe('https://www.bibleserver.com/Ne%C3%9C/Spr%C3%BCche12%2C5-13');
  });

  it('addresses a single verse and a whole chapter', () => {
    expect(
      scriptureReferenceUrl({ book: 'Proverbs', chapter: 12, verseStart: 5 }),
    ).toBe('https://www.bibleserver.com/Ne%C3%9C/Spr%C3%BCche12%2C5');
    expect(scriptureReferenceUrl({ book: 'Psalms', chapter: 23 })).toBe(
      'https://www.bibleserver.com/Ne%C3%9C/Psalm23',
    );
  });

  it('refuses a book that is not one', () => {
    expect(() => scriptureReferenceUrl({ book: 'Hesiod', chapter: 1 })).toThrow(
      TypeError,
    );
  });
});
