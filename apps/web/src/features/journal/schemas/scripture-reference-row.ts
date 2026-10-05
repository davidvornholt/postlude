import { Schema } from 'effect';

import type { ScriptureReference } from '../scripture-reference.ts';

const VerseNumber = Schema.Int.check(Schema.isGreaterThan(0));
const containsLetter = /\p{L}/u;

/** `ScriptureReference` as a schema, for shapes that carry the parsed value. */
export const ScriptureReferenceSchema: Schema.Codec<ScriptureReference> =
  Schema.Struct({
    book: Schema.String,
    chapter: Schema.Number,
    verseStart: Schema.optionalKey(Schema.Number),
    verseEnd: Schema.optionalKey(Schema.Number),
  });

export type ScriptureReferenceRow = {
  readonly scriptureBook: string | null;
  readonly scriptureChapter: number | null;
  readonly scriptureVerseStart: number | null;
  readonly scriptureVerseEnd: number | null;
};

export const scriptureReferenceRowFields = {
  scriptureBook: Schema.NullOr(Schema.String),
  scriptureChapter: Schema.NullOr(VerseNumber),
  scriptureVerseStart: Schema.NullOr(VerseNumber),
  scriptureVerseEnd: Schema.NullOr(VerseNumber),
} as const;

/** The column each of `scriptureReferenceRowFields` is read from. */
export const scriptureReferenceRowKeys = {
  scriptureBook: 'scripture_book',
  scriptureChapter: 'scripture_chapter',
  scriptureVerseStart: 'scripture_verse_start',
  scriptureVerseEnd: 'scripture_verse_end',
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
