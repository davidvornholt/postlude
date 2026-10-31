/**
 * The model's answer as a note Postlude stores: plain text within
 * `agentNoteCharacterLimit`.
 *
 * The prompt asks for plain text, and this holds the answer to it whatever came
 * back. Markdown marks are taken out rather than rendered, web addresses are
 * dropped because a note never needs one, and an answer that runs long is cut
 * at the last sentence that fits. An answer with nothing left, or with no
 * sentence end in the first half of the limit, isn't a note.
 */

import { agentNoteCharacterLimit } from './agent-note-prompt.ts';

/** Control characters other than the line feed, which separates paragraphs. */
const controlCharacters = /[^\P{Cc}\n]/gu;
const lineStartMarks = /^\s*(?:#{1,6}\s+|>\s?|[-*+•]\s+|\d{1,3}[.)]\s+)/u;
const markdownImage = /!\[[^\]]*\]\([^)]*\)/gu;
const markdownLink = /\[(?<text>[^\]]*)\]\([^)]*\)/gu;
/** A web address, without the punctuation that ends its sentence. */
const webAddress = /<?\bhttps?:\/\/[^\s>]*[^\s>.,;:!?)"'»”]>?/gu;
const emphasisMarks = /\*\*|__|`+/gu;
const sentenceEnd = /[.!?…]["'»«“”„)]*(?=\s|$)/gu;

const plainLineOf = (line: string) =>
  line
    .replace(lineStartMarks, '')
    .replace(/[ \t]+/gu, ' ')
    .trim();

/** The text up to the last sentence end within the limit, if it is long enough. */
const cutAtSentenceEnd = (text: string) => {
  const head = text.slice(0, agentNoteCharacterLimit);
  const last = [...head.matchAll(sentenceEnd)].at(-1);
  if (last === undefined) {
    return;
  }
  const end = last.index + last[0].length;
  return end >= agentNoteCharacterLimit / 2 ? head.slice(0, end) : undefined;
};

/** The note, or undefined when the answer can't be one. */
export const agentNoteTextOf = (answer: string): string | undefined => {
  const text = answer
    .replace(/\r\n?/gu, '\n')
    .replace(controlCharacters, ' ')
    .replace(markdownImage, '')
    .replace(markdownLink, '$<text>')
    .replace(webAddress, '')
    .replace(emphasisMarks, '')
    .split('\n')
    .map(plainLineOf)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  if (text === '') {
    return;
  }
  return text.length <= agentNoteCharacterLimit ? text : cutAtSentenceEnd(text);
};
