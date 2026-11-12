/**
 * Text read from an old report page, held to what a document allows: labels
 * of at most 200 characters, prose in spans of at most 10,000, and nothing
 * blank. Also the conversion's last resort, a page's words as paragraphs.
 */

import {
  type ReportBlock,
  type ReportDocument,
  reportDocumentVersion,
} from '../schemas/day-report-blocks.ts';
import type { RichText } from '../schemas/day-report-text.ts';
import {
  foldSpace,
  type HtmlElement,
  type HtmlNode,
  isElement,
} from './html-tree.ts';

const labelLimit = 200;
const spanLimit = 10_000;
const spansPerText = 200;
const blocksPerDocument = 400;

/** Text as a label, cut short with an ellipsis where it is too long. */
export const labelOf = (text: string): string | undefined => {
  const folded = foldSpace(text);
  if (folded === '') {
    return undefined;
  }
  return folded.length <= labelLimit
    ? folded
    : `${folded.slice(0, labelLimit - 1)}…`;
};

/** Text as plain rich text, in as many spans as its length needs. */
export const richOf = (text: string): RichText | undefined => {
  const folded = foldSpace(text);
  if (folded === '') {
    return undefined;
  }
  const spans: Array<string> = [];
  for (
    let at = 0;
    at < folded.length && spans.length < spansPerText;
    at += spanLimit
  ) {
    spans.push(folded.slice(at, at + spanLimit));
  }
  return spans;
};

/** Lines of text as rich text each, leaving out the blank ones. */
export const richLinesOf = (lines: ReadonlyArray<string>): Array<RichText> =>
  lines.flatMap((line) => {
    const rich = richOf(line);
    return rich === undefined ? [] : [rich];
  });

export const paragraphOf = (text: string): ReadonlyArray<ReportBlock> => {
  const rich = richOf(text);
  return rich === undefined ? [] : [{ kind: 'paragraph', text: rich }];
};

/** Elements whose text the fallback reads as one line each. */
const lineTags = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'dt',
  'dd',
  'td',
  'th',
  'caption',
  'summary',
  'blockquote',
  'pre',
  'figcaption',
]);

/** What a page never shows as words: its head, controls, and drawings. */
const silentTags = new Set(['head', 'button', 'svg', 'script', 'style']);

type Line = { text: string };

/**
 * The words of an element as lines, in the order they appear: one for each
 * paragraph, list item, heading, term, or cell, and one for loose text in a
 * container. Placeholders that a page's script filled in, and what it hid,
 * have no words of their own.
 */
export const textLinesOf = (element: HtmlElement): ReadonlyArray<string> => {
  const lines: Array<Line> = [];
  const walk = (node: HtmlNode, line: Line): void => {
    if (!isElement(node)) {
      line.text += node.text;
      return;
    }
    if (
      silentTags.has(node.tag) ||
      node.attributes.has('data-metric') ||
      node.attributes.has('hidden')
    ) {
      return;
    }
    const own = lineTags.has(node.tag) ? { text: '' } : line;
    if (own !== line) {
      lines.push(own);
    }
    for (const child of node.children) {
      walk(child, own);
    }
  };
  const loose: Line = { text: '' };
  lines.push(loose);
  for (const child of element.children) {
    walk(child, loose);
  }
  return lines.map(({ text }) => foldSpace(text)).filter((text) => text !== '');
};

/** An element's words as paragraphs, for content the conversion doesn't know. */
export const paragraphsOf = (
  element: HtmlElement,
): ReadonlyArray<ReportBlock> => textLinesOf(element).flatMap(paragraphOf);

const convertedNote: ReportBlock = {
  kind: 'callout',
  tone: 'note',
  text: [
    'This report was converted from an older page whose layout Postlude does not know, so only its words are shown.',
  ],
};

/**
 * A page as its words alone, the conversion's answer for a shape it doesn't
 * know, or nothing for a page without any words.
 */
export const textDocument = (page: HtmlElement): ReportDocument | undefined => {
  const paragraphs = paragraphsOf(page);
  return paragraphs.length === 0
    ? undefined
    : {
        version: reportDocumentVersion,
        blocks: [convertedNote, ...paragraphs].slice(0, blocksPerDocument),
      };
};
