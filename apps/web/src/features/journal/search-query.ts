/**
 * What a typed search means, and what a result looks like when it is read back.
 *
 * The journal is written in more than one language, so the index is built with
 * Postgres's `simple` configuration — no stemming, no stopword list — and every
 * term is matched as a prefix instead. "Gebet" finds "Gebete" and "schreib"
 * finds "schreiben" without the index having to be told which language a day
 * was written in, and no word is ever dropped from a day for being common in a
 * language the writer was not using.
 *
 * Non-word runs become boundaries before a term goes anywhere near the
 * database. That is what makes appending the prefix marker safe: there is
 * nothing left in a term that Postgres's query parser could read as syntax.
 */

const wordBoundaries = /[^\p{L}\p{N}]+/gu;
const whitespaceRuns = /\s+/gu;

/** How much of the day is shown around the first match. */
const excerptLength = 240;
/** How much of it sits before the match, so the match is not flush left. */
const leadingContext = 60;

export type ExcerptSegment = {
  readonly text: string;
  /** This run of text is one of the words the search was for. */
  readonly match: boolean;
  /** Where the run starts in the excerpt, which is what makes it identifiable. */
  readonly at: number;
};

/**
 * Text has one canonical Unicode shape before it is indexed, queried, or shown
 * as a match. NFKC also makes compatibility forms such as full-width letters
 * mean the same thing as their ordinary keyboard forms.
 */
export const normalizeSearchText = (text: string): string =>
  text.normalize('NFKC');

/**
 * The words to look for. Punctuation is a boundary rather than query syntax,
 * so `rain,fell` asks for two words instead of silently becoming `rainfell`.
 */
export const searchTerms = (query: string): ReadonlyArray<string> =>
  normalizeSearchText(query)
    .toLowerCase()
    .replace(wordBoundaries, ' ')
    .trim()
    .split(whitespaceRuns)
    .filter((word) => word.length > 0);

/**
 * The terms as one `tsquery`: every term has to appear, each as a prefix. A day
 * that holds only some of the words is not what was asked for.
 */
export const searchTsQuery = (terms: ReadonlyArray<string>): string =>
  terms.map((term) => `${term}:*`).join(' & ');

/** Matches a term where a word starts, and takes the rest of that word with it. */
const termPattern = (terms: ReadonlyArray<string>): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${terms.map(normalizeSearchText).join('|')})[\\p{L}\\p{N}]*`,
    'giu',
  );

/** Steps back to the space before `at`, so an excerpt never opens mid-word. */
const wordStartAt = (text: string, at: number): number => {
  if (at <= 0) {
    return 0;
  }
  const space = text.lastIndexOf(' ', at);
  return space === -1 ? 0 : space + 1;
};

/** Steps forward to the space after `at`, so an excerpt never ends mid-word. */
const wordEndAt = (text: string, at: number): number => {
  if (at >= text.length) {
    return text.length;
  }
  const space = text.indexOf(' ', at);
  return space === -1 ? text.length : space;
};

const segmentsOf = (
  text: string,
  pattern: RegExp,
): ReadonlyArray<ExcerptSegment> => {
  const segments: Array<ExcerptSegment> = [];
  let cursor = 0;
  for (const found of text.matchAll(pattern)) {
    if (found.index > cursor) {
      segments.push({
        text: text.slice(cursor, found.index),
        match: false,
        at: cursor,
      });
    }
    segments.push({ text: found[0], match: true, at: found.index });
    cursor = found.index + found[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false, at: cursor });
  }
  return segments;
};

/**
 * The part of a day worth showing for a search, with the matched words marked.
 *
 * It opens at the first match rather than at the top of the day, because a word
 * found in the last paragraph is not evidence that the first paragraph is what
 * the writer was looking for. A day that matched only on a stemmed or prefixed
 * form the plain text does not literally contain falls back to its opening,
 * which is still a truer answer than an empty result row.
 *
 * The text is prose rather than markdown, and the marks are handed back as runs
 * rather than as HTML, so nothing here can put markup on a page.
 */
export const searchExcerpt = (
  plainText: string,
  terms: ReadonlyArray<string>,
): ReadonlyArray<ExcerptSegment> => {
  const text = normalizeSearchText(plainText)
    .replace(whitespaceRuns, ' ')
    .trim();
  if (text === '') {
    return [];
  }
  if (terms.length === 0) {
    return [{ text, match: false, at: 0 }];
  }
  const pattern = termPattern(terms);
  // `search` answers -1 for a day that holds no literal match, and the clamp
  // turns that into the opening of the day without a second branch for it.
  const firstAt = text.search(pattern);
  const start = wordStartAt(text, Math.max(0, firstAt - leadingContext));
  const end = wordEndAt(text, start + excerptLength);
  // The ellipses go in before the runs are cut, so a segment's offset is a
  // position in the excerpt as shown rather than in the day it came from.
  const excerpt = [
    start > 0 ? '… ' : '',
    text.slice(start, end),
    end < text.length ? ' …' : '',
  ].join('');
  return segmentsOf(excerpt, pattern);
};
