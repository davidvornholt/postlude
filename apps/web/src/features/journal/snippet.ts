/**
 * The opening of an entry, short enough to sit in a list.
 *
 * It is taken from the prose rather than from the markdown, by the same reader
 * the word count uses, so a day that opens with a heading or a quote shows the
 * words the writer wrote rather than the hashes and angle brackets around them.
 *
 * The cut prefers a word boundary and falls back to a grapheme boundary for a
 * token with no spaces. The ellipsis counts toward the limit and only appears
 * when something was left out.
 */

import { journalPlainText } from './word-count.ts';

/** Maximum visible grapheme clusters, including a truncation ellipsis. */
export const snippetLength = 200;
const whitespaceRuns = /\s+/gu;
const lastWord = /\s\S*$/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const ellipsis = '…';
const ellipsisLength = 1;

export const journalSnippet = (markdown: string): string => {
  const text = journalPlainText(markdown).replace(whitespaceRuns, ' ');
  const characters = Array.from(
    graphemes.segment(text),
    (part) => part.segment,
  );
  if (characters.length <= snippetLength) {
    return text;
  }
  const contentLimit = snippetLength - ellipsisLength;
  const candidate = characters.slice(0, contentLimit).join('');
  const next = characters[contentLimit] ?? '';
  const wordSafe =
    candidate.endsWith(' ') || next === ' '
      ? candidate.trimEnd()
      : candidate.replace(lastWord, '');
  return `${wordSafe === '' ? candidate : wordSafe}${ellipsis}`;
};

type ArchiveSnippetSource = {
  readonly journalMarkdown: string;
  readonly journalWordCount: number;
  readonly scriptureMarkdown: string;
};

/** Prefer the evening opening, then fall back to scripture notes. */
export const archiveSnippet = (entry: ArchiveSnippetSource): string =>
  journalSnippet(
    entry.journalWordCount > 0
      ? entry.journalMarkdown
      : entry.scriptureMarkdown,
  );
