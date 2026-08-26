/**
 * What the writer is told they have written, and what the archive buckets a day
 * by. Both read the prose rather than the markdown that carries it: a heading is
 * one word, not two, and a fenced code block's fence is not a word at all.
 *
 * The count is taken from the stored markdown rather than from the editor, so an
 * entry that arrives from an importer is counted exactly as a typed one is. That
 * is also why it lives here rather than in the editor's own code.
 */

const backtickFencedBlock =
  /^ {0,3}(?<fence>`{3,})[^`\r\n]*\r?\n[\s\S]*?^ {0,3}\k<fence>`*[ \t]*\r?$/gmu;
const tildeFencedBlock =
  /^ {0,3}(?<fence>~{3,})[^\r\n]*\r?\n[\s\S]*?^ {0,3}\k<fence>~*[ \t]*\r?$/gmu;
const unclosedFence = /^ {0,3}(?:`{3,}[^`\r\n]*|~{3,}[^\r\n]*)\r?$[\s\S]*/mu;
const htmlComment = /<!--[\s\S]*?-->/gu;
const image = /!\[(?<alt>[^\]]*)\]\([^)]*\)/gu;
const inlineLink = /\[(?<label>[^\]]*)\]\([^)]*\)/gu;
const referenceLink = /\[(?<label>[^\]]*)\]\[[^\]]*\]/gu;
const autolink = /<(?<target>https?:\/\/[^>\s]+)>/gu;
const linkDefinition = /^[ \t]*\[[^\]]+\]:[ \t]*\S+.*$/gmu;
const inlineCode = /(?<ticks>`+)(?<code>[^`]*?)\k<ticks>/gu;
const blockMarker =
  /^[ \t]*(?:>[ \t]?|#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+)/gmu;
const thematicBreak = /^[ \t]*(?:[-*_][ \t]*){3,}$/gmu;
const setextUnderline = /^[ \t]*(?:=+|-+)[ \t]*$/gmu;
const tablePipe = /[|]/gu;
const tableDivider = /^[ \t]*:?-{3,}:?(?:[ \t]*[|][ \t]*:?-+:?)*[ \t]*$/gmu;
const emphasis = /(?<!\\)(?:\*{1,3}|_{1,3}|~{2})/gu;
const escaped = /\\(?<character>[\\`*_{}[\]()#+\-.!>~|])/gu;

/**
 * The words of a markdown document, with the syntax that carries them taken
 * out. A link keeps its label and loses its target, and an image loses
 * everything — alt text describes a picture rather than being prose the writer
 * wrote.
 *
 * Code is split by how it is set. A fenced block is dropped whole, because a
 * count that grew while pasting a configuration file would not be a count of
 * anything the writer said. Inline code is kept, because there it is a word in
 * a sentence: the writer who typed "ran `bun run check` today" wrote all five.
 *
 * An unclosed fence takes the rest of the document with it. That is the state a
 * writer is in for the moment between typing the opening fence and the closing
 * one, and letting the count leap while the block is still open would make the
 * number jump around under the writer's hands.
 */
export const journalPlainText = (markdown: string): string =>
  markdown
    .replace(backtickFencedBlock, ' ')
    .replace(tildeFencedBlock, ' ')
    .replace(unclosedFence, ' ')
    .replace(htmlComment, ' ')
    .replace(linkDefinition, ' ')
    .replace(image, ' ')
    .replace(inlineLink, ' $<label> ')
    .replace(referenceLink, ' $<label> ')
    .replace(autolink, ' $<target> ')
    .replace(inlineCode, ' $<code> ')
    .replace(thematicBreak, ' ')
    .replace(setextUnderline, ' ')
    .replace(tableDivider, ' ')
    .replace(blockMarker, ' ')
    .replace(tablePipe, ' ')
    .replace(emphasis, '')
    .replace(escaped, '$<character>')
    .trim();

/**
 * A word is a run of anything that is not whitespace. Punctuation on its own
 * still counts — an em dash alone on a line is rare enough not to be worth the
 * rule it would take to exclude it, and a rule that dropped it would also drop
 * a word the writer meant.
 */
const whitespaceRun = /\s+/u;

export const countJournalWords = (markdown: string): number => {
  const text = journalPlainText(markdown);
  return text === '' ? 0 : text.split(whitespaceRun).length;
};

/**
 * Characters of prose, counted the way a reader would: by what the text is made
 * of rather than by how it is stored. Splitting into grapheme clusters keeps an
 * accented letter, an emoji, and a flag each one character, where the string's
 * own `length` would call them two, several, or more.
 */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export const countJournalCharacters = (markdown: string): number => {
  const text = journalPlainText(markdown);
  return text === '' ? 0 : [...graphemes.segment(text)].length;
};
