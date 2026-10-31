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

/**
 * The text up to the last sentence end within the limit, if it is long enough.
 * Sentence ends are found in the whole text, so a cut through `3.14` at the
 * limit isn't mistaken for one.
 */
const cutAtSentenceEnd = (text: string) => {
  const end = [...text.matchAll(sentenceEnd)]
    .map((match) => match.index + match[0].length)
    .filter((matchEnd) => matchEnd <= agentNoteCharacterLimit)
    .at(-1);
  if (end === undefined) {
    return;
  }
  return end >= agentNoteCharacterLimit / 2 ? text.slice(0, end) : undefined;
};

/**
 * The answer as the note Postlude stores: plain text within
 * `agentNoteCharacterLimit`, whatever the model sent back. It is undefined when
 * the answer can't be a note.
 */
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
