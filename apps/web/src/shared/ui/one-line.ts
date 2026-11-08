/**
 * A line break, with the spaces on either side of it. `\s` already covers the
 * breaks, so this is any run of white space that has at least one in it.
 */
const lineBreak = /\s*[\n\r\u2028\u2029]\s*/gu;

/**
 * The text as one paragraph: each line break, and the spaces around it,
 * becomes a single space.
 */
export const asOneLine = (text: string): string => text.replace(lineBreak, ' ');
