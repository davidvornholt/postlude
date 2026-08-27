/**
 * What a typed search means, and what a result looks like when it is read back.
 *
 * The journal is written in more than one language, so the app stores its own
 * normalized tokens without stemming or a stopword list. Every term is matched
 * as a prefix. "Gebet" finds "Gebete" and "schreib" finds "schreiben" without
 * choosing a language, and no word disappears for being common in the wrong
 * one.
 *
 * Non-word runs become boundaries before a term goes anywhere near the
 * database. That is what makes appending the prefix marker safe: there is
 * nothing left in a term that Postgres's query parser could read as syntax.
 */

const searchTokenRuns = /[\p{L}\p{N}]+/gu;
const dottedLowercaseI = /i\u0307/gu;
const finalGreekSigma = /\u03c2/gu;

/**
 * Text has one canonical Unicode shape before it is indexed, queried, or shown
 * as a match. NFKC also makes compatibility forms such as full-width letters
 * mean the same thing as their ordinary keyboard forms.
 */
export const normalizeSearchText = (text: string): string =>
  text.normalize('NFKC');

/**
 * One application-owned case shape for both indexed text and queries. The two
 * replacements close the case-folding differences that matter to this journal:
 * JavaScript lowers dotted capital I to two code points, and Greek has a
 * position-dependent final sigma even though both sigmas name the same letter.
 */
export const foldSearchText = (text: string): string =>
  normalizeSearchText(text)
    .toLowerCase()
    .replace(dottedLowercaseI, 'i')
    .replace(finalGreekSigma, '\u03c3')
    .normalize('NFC');

/** The canonical token stream persisted for indexing and used for queries. */
export const searchTokens = (text: string): ReadonlyArray<string> =>
  foldSearchText(text).match(searchTokenRuns) ?? [];

export const searchTokenText = (text: string): string =>
  searchTokens(text).join(' ');

/**
 * The words to look for. Punctuation is a boundary rather than query syntax,
 * so `rain,fell` asks for two words instead of silently becoming `rainfell`.
 */
export const searchTerms = (query: string): ReadonlyArray<string> => [
  ...new Set(searchTokens(query)),
];

/**
 * The terms as one `tsquery`: every term has to appear, each as a prefix. A day
 * that holds only some of the words is not what was asked for.
 */
export const searchTsQuery = (terms: ReadonlyArray<string>): string =>
  terms.map((term) => `${term}:*`).join(' & ');
