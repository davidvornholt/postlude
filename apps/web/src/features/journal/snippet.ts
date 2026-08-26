/**
 * The opening of an entry, short enough to sit in a list.
 *
 * It is taken from the prose rather than from the markdown, by the same reader
 * the word count uses, so a day that opens with a heading or a quote shows the
 * words the writer wrote rather than the hashes and angle brackets around them.
 *
 * The cut lands on a word boundary and the ellipsis is only added when
 * something was actually left out, so a short entry is shown whole rather than
 * shown as if it continued.
 */

import { journalPlainText } from './word-count.ts';

/** The longest an opening can be before it is cut back to a word boundary. */
export const snippetLength = 200;
const whitespaceRuns = /\s+/gu;
const lastWord = /\s\S*$/u;

export const journalSnippet = (markdown: string): string => {
  const text = journalPlainText(markdown).replace(whitespaceRuns, ' ');
  if (text.length <= snippetLength) {
    return text;
  }
  return `${text.slice(0, snippetLength + 1).replace(lastWord, '')}…`;
};
