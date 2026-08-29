import { Schema } from 'effect';

import type { ScriptureReference } from '../scripture-reference.ts';

const VerseNumber = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0));
const containsLetter = /\p{L}/u;

export type ScriptureReferenceRow = {
  readonly scriptureBook: string | null;
  readonly scriptureChapter: number | null;
  readonly scriptureVerseStart: number | null;
  readonly scriptureVerseEnd: number | null;
};

export const scriptureReferenceRowFields = {
  scriptureBook: Schema.propertySignature(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('scripture_book'),
  ),
  scriptureChapter: Schema.propertySignature(Schema.NullOr(VerseNumber)).pipe(
    Schema.fromKey('scripture_chapter'),
  ),
  scriptureVerseStart: Schema.propertySignature(
    Schema.NullOr(VerseNumber),
  ).pipe(Schema.fromKey('scripture_verse_start')),
  scriptureVerseEnd: Schema.propertySignature(Schema.NullOr(VerseNumber)).pipe(
    Schema.fromKey('scripture_verse_end'),
  ),
} as const;

export const hasCoherentScriptureReference = (
  row: ScriptureReferenceRow,
): boolean =>
  (row.scriptureBook === null) === (row.scriptureChapter === null) &&
  (row.scriptureVerseStart === null || row.scriptureChapter !== null) &&
  (row.scriptureVerseEnd === null ||
    (row.scriptureVerseStart !== null &&
      row.scriptureVerseEnd >= row.scriptureVerseStart)) &&
  (row.scriptureBook === null || containsLetter.test(row.scriptureBook));

/** The four nullable database columns as the one value the app passes around. */
export const scriptureReferenceOfRow = (
  row: ScriptureReferenceRow,
): ScriptureReference | undefined => {
  if (row.scriptureBook === null || row.scriptureChapter === null) {
    return undefined;
  }
  const chapter = row.scriptureChapter;
  if (row.scriptureVerseStart === null) {
    return { book: row.scriptureBook, chapter };
  }
  const verseStart = row.scriptureVerseStart;
  return row.scriptureVerseEnd === null
    ? { book: row.scriptureBook, chapter, verseStart }
    : {
        book: row.scriptureBook,
        chapter,
        verseStart,
        verseEnd: row.scriptureVerseEnd,
      };
};
