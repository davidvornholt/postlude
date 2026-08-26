/**
 * The morning scripture reference: what the writer types, what the database
 * keeps, what the page shows, and where tapping it goes.
 *
 * The reference is stored broken apart — book, chapter, first verse, last verse
 * — rather than as the line that was typed. That is what lets the page render
 * one house style whatever was typed, sort a list of references by where they
 * fall in the bible, and build a link without parsing prose a second time. The
 * database enforces the same shape with check constraints, so a half-filled
 * reference cannot be stored even by a writer that skips this module.
 */

import { type ScriptureBook, scriptureBooks } from './scripture-books.ts';

export type ScriptureReference = {
  /** The canonical English book name, as `scripture-books.ts` spells it. */
  readonly book: string;
  readonly chapter: number;
  /** Absent when the reference is a whole chapter, as "Psalms 23" is. */
  readonly verseStart?: number;
  /** Absent when the reference is a single verse. */
  readonly verseEnd?: number;
};

/**
 * The form a name is matched in: lower case, with dots, spaces, and hyphens
 * gone, and umlauts folded to the letters a keyboard reaches without them. It
 * is why "1 Cor", "1.Kor", "1kor", and "Sprueche" need no entries of their own.
 * Folding is done by decomposing and dropping the combining marks, so ä becomes
 * a and é becomes e without a table; ß is spelled out first, because it has no
 * decomposition and German keyboards are not the only ones this is typed on.
 */
const foldName = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[\s.\-']/gu, '');

/**
 * German spells an umlaut out as a following e when the keyboard has no umlaut
 * key, and "Sprueche" is a spelling of the same word rather than a misspelling.
 * Dropping the mark gives "spruche" instead, so both forms are registered and a
 * writer on either keyboard is understood.
 */
const spellOutUmlauts = (name: string): string =>
  name
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('Ä', 'Ae')
    .replaceAll('Ö', 'Oe')
    .replaceAll('Ü', 'Ue');

const byFoldedName = new Map<string, ScriptureBook>();
for (const book of scriptureBooks) {
  for (const name of [book.english, book.german, ...book.aliases]) {
    for (const spelling of [foldName(name), foldName(spellOutUmlauts(name))]) {
      // First writer wins, so a canonical name is never shadowed by another
      // book's alias — "Johannes" stays John rather than becoming 1 John.
      if (!byFoldedName.has(spelling)) {
        byFoldedName.set(spelling, book);
      }
    }
  }
}

/** Also accepts "Sprueche" for "Sprüche", which folding already handles. */
export const findScriptureBook = (name: string): ScriptureBook | undefined =>
  byFoldedName.get(foldName(name));

/**
 * A reference is a book, then a chapter, then optionally verses. The separator
 * between chapter and verse may be a colon or a comma, because English writes
 * "Proverbs 12:5" and German writes "Sprüche 12,5" and the writer uses both. The
 * dash before a closing verse may be any of the three a keyboard or an
 * autocorrect produces.
 *
 * The book part is everything before the first digit that starts a chapter,
 * which is what lets a leading number stay part of the name: in "1 Kings 3:5"
 * the "1" belongs to the book and the "3" does not.
 */
const referencePattern =
  /^\s*(?<book>\d?\s*[^\d]+?)\s*(?<chapter>\d+)\s*(?:[:,]\s*(?<verseStart>\d+)\s*(?:[-–—]\s*(?<verseEnd>\d+))?)?\s*$/u;

/**
 * Reads a typed reference, or returns undefined when it is not one. Undefined
 * rather than a thrown error because the writer is mid-sentence for most of the
 * keystrokes it takes to type one, and being partway through is not a failure.
 */
export const parseScriptureReference = (
  text: string,
): ScriptureReference | undefined => {
  const parts = referencePattern.exec(text)?.groups;
  if (parts === undefined) {
    return undefined;
  }

  const book = findScriptureBook(parts.book);
  const chapter = Number(parts.chapter);
  if (book === undefined || chapter < 1) {
    return undefined;
  }

  if (parts.verseStart === undefined) {
    return { book: book.english, chapter };
  }

  const verseStart = Number(parts.verseStart);
  if (verseStart < 1) {
    return undefined;
  }
  if (parts.verseEnd === undefined) {
    return { book: book.english, chapter, verseStart };
  }

  const verseEnd = Number(parts.verseEnd);
  // A range that ends before it starts is a typo, not a reference. A range that
  // ends where it starts is the single verse it names.
  if (verseEnd < verseStart) {
    return undefined;
  }
  return verseEnd === verseStart
    ? { book: book.english, chapter, verseStart }
    : { book: book.english, chapter, verseStart, verseEnd };
};

/** The one house style: "Proverbs 12:5-13", "Proverbs 12:5", "Psalms 23". */
export const formatScriptureReference = ({
  book,
  chapter,
  verseStart,
  verseEnd,
}: ScriptureReference): string => {
  if (verseStart === undefined) {
    return `${book} ${chapter}`;
  }
  const verses =
    verseEnd === undefined ? verseStart : `${verseStart}-${verseEnd}`;
  return `${book} ${chapter}:${verses}`;
};

/**
 * Where the reference opens. The NeÜ is the translation Postlude reads, and
 * bibleserver.com addresses a passage as book, chapter, then the verse range
 * after a comma — German punctuation, because it is a German site.
 *
 * Both the translation and the book name carry characters that have to be
 * percent-encoded, and `encodeURIComponent` is what does it, so the URL is built
 * from encoded pieces rather than by encoding a finished string.
 */
const translation = 'NeÜ';

export const scriptureReferenceUrl = ({
  book,
  chapter,
  verseStart,
  verseEnd,
}: ScriptureReference): string => {
  const german = findScriptureBook(book)?.german;
  if (german === undefined) {
    throw new TypeError(`Not a book of the bible: ${book}`);
  }

  const passage =
    verseStart === undefined
      ? `${german}${chapter}`
      : `${german}${chapter},${verseStart}${verseEnd === undefined ? '' : `-${verseEnd}`}`;

  return `https://www.bibleserver.com/${encodeURIComponent(translation)}/${encodeURIComponent(passage)}`;
};
