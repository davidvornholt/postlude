import type {
  MarkdownLexerConfiguration,
  MarkdownToken,
  MarkdownTokenizer,
} from '@tiptap/core';
import {
  detectMarkerType,
  markerToStart,
  ORDERED_LIST_MARKER_PATTERN,
} from '@tiptap/extension-list';

// Reads numbered lists the way the tokenizer in @tiptap/extension-list 3.34
// does, except that a continuation line of an item loses the whole width of
// the item's marker, where Tiptap leaves out the `.` or `)`. Go back to
// Tiptap's tokenizer once it counts the separator and
// `journal-ordered-list.test.ts` passes without this file.

const orderedItemLine = new RegExp(
  `^(\\s*)(${ORDERED_LIST_MARKER_PATTERN})([.)])(\\s+)(.*)$`,
  'u',
);
const indentedLine = /^\s/u;
const separatorWidth = 1;
// CommonMark: after five or more spaces the item's text starts after the first
// one and the rest indents a code block, and an item that is only a marker
// takes its continuation one space past the marker.
const maxSpacesAfterMarker = 4;

// Blocks that can interrupt a paragraph, so a line starting with one of them
// can never be lazy continuation text of an item.
const heading = /^#{1,6}(?:\s|$)/u;
const bulletItem = /^[-+*]\s+/u;
const codeFence = /^(?:```|~~~)/u;
const blockMath = /^\$\$/u;
const thematicBreak = /^(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/u;
const paragraphInterrupters = [
  heading,
  bulletItem,
  codeFence,
  blockMath,
  thematicBreak,
];
const blockQuote = /^>\s?/u;

type OrderedItem = {
  readonly indent: number;
  readonly number: number;
  readonly type: string | undefined;
  readonly contentLines: Array<string>;
  readonly raw: string;
};

const isBlockContentLine = (line: string): boolean => {
  const trimmed = line.trimStart();
  return (
    bulletItem.test(trimmed) ||
    orderedItemLine.test(trimmed) ||
    heading.test(trimmed) ||
    // `---` right below paragraph text underlines a heading.
    (thematicBreak.test(trimmed) && !trimmed.startsWith('-')) ||
    blockQuote.test(trimmed) ||
    codeFence.test(trimmed) ||
    blockMath.test(trimmed)
  );
};

const interruptsLazyContinuation = (line: string): boolean =>
  paragraphInterrupters.some((pattern) => pattern.test(line));

const splitItemContent = (
  contentLines: ReadonlyArray<string>,
): { paragraphLines: Array<string>; blockLines: Array<string> } => {
  const boundary = contentLines.findIndex(
    (line, index) =>
      line.trim() === '' || (index > 0 && isBlockContentLine(line)),
  );
  return boundary === -1
    ? { paragraphLines: [...contentLines], blockLines: [] }
    : {
        paragraphLines: contentLines.slice(0, boundary),
        blockLines: contentLines.slice(boundary),
      };
};

const contentIndentOf = (
  indent: string,
  marker: string,
  spaces: string,
  content: string,
): number =>
  indent.length +
  marker.length +
  separatorWidth +
  (content === '' || spaces.length > maxSpacesAfterMarker ? 1 : spaces.length);

// The text a continuation line adds to its item, or undefined where the item
// ends.
const continuationOf = (
  line: string,
  contentIndent: number,
  sawBlankLine: boolean,
): string | undefined => {
  if (orderedItemLine.test(line)) {
    return undefined;
  }
  if (line.trim() === '') {
    return '';
  }
  if (indentedLine.test(line)) {
    const leading = line.length - line.trimStart().length;
    return line.slice(Math.min(leading, contentIndent));
  }
  return sawBlankLine || interruptsLazyContinuation(line) ? undefined : line;
};

/** Reads the item starting at `start`, returning it and the line after it. */
const collectItem = (
  lines: ReadonlyArray<string>,
  start: number,
): [OrderedItem, number] | undefined => {
  const line = lines[start] ?? '';
  const match = orderedItemLine.exec(line);
  if (match === null) {
    return undefined;
  }
  const [, indent = '', marker = '', , spaces = '', content = ''] = match;
  const contentIndent = contentIndentOf(indent, marker, spaces, content);
  const contentLines = [content];
  const itemLines = [line];
  let sawBlankLine = false;
  let index = start + 1;
  while (index < lines.length) {
    const next = lines[index] ?? '';
    const text = continuationOf(next, contentIndent, sawBlankLine);
    if (text === undefined) {
      break;
    }
    sawBlankLine ||= text === '';
    contentLines.push(text);
    itemLines.push(next);
    index += 1;
  }
  const number = Number.parseInt(marker, 10);
  const item = {
    indent: indent.length,
    number: Number.isNaN(number) ? markerToStart(marker) : number,
    type: Number.isNaN(number) ? detectMarkerType(marker) : undefined,
    contentLines,
    raw: itemLines.join('\n'),
  };
  return [item, index];
};

/** Reads consecutive items into a flat list; nesting comes from their indent. */
const collectItems = (
  lines: ReadonlyArray<string>,
): [Array<OrderedItem>, number] => {
  const items: Array<OrderedItem> = [];
  let index = 0;
  let collected = collectItem(lines, index);
  while (collected !== undefined) {
    const [item, next] = collected;
    items.push(item);
    index = next;
    collected = collectItem(lines, index);
  }
  return [items, index];
};

const scanWindow = 64;

// Fewer than `max` lines means `source` ended.
const takeLines = (source: string, max: number): Array<string> => {
  const lines: Array<string> = [];
  let start = 0;
  while (lines.length < max) {
    const lineEnd = source.indexOf('\n', start);
    if (lineEnd === -1) {
      lines.push(source.slice(start));
      return lines;
    }
    lines.push(source.slice(start, lineEnd));
    start = lineEnd + 1;
  }
  return lines;
};

// Every block start is offered to the tokenizer, so it reads only the lines a
// list needs and rejects other blocks on their first line.
const collectItemsFromSource = (
  source: string,
): [Array<OrderedItem>, number, Array<string>] => {
  const firstLineEnd = source.indexOf('\n');
  const firstLine =
    firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
  if (!orderedItemLine.test(firstLine)) {
    return [[], 0, []];
  }
  let windowSize = scanWindow;
  let lines = takeLines(source, windowSize);
  let [items, consumed] = collectItems(lines);
  while (consumed === lines.length && lines.length === windowSize) {
    windowSize *= 2;
    lines = takeLines(source, windowSize);
    [items, consumed] = collectItems(lines);
  }
  return [items, consumed, lines];
};

const itemTokens = (
  item: OrderedItem,
  lexer: MarkdownLexerConfiguration,
): Array<MarkdownToken> => {
  const { paragraphLines, blockLines } = splitItemContent(item.contentLines);
  const mainText = paragraphLines.join('\n').trim();
  const blocks = blockLines.join('\n').trim();
  return [
    ...(mainText === ''
      ? []
      : [
          {
            type: 'paragraph',
            raw: mainText,
            tokens: lexer.inlineTokens(mainText),
          },
        ]),
    ...(blocks === '' ? [] : lexer.blockTokens(blocks)),
  ];
};

// Items indented deeper than the one before them form its nested list.
const nestedListItems = (
  items: ReadonlyArray<OrderedItem>,
  baseIndent: number,
  lexer: MarkdownLexerConfiguration,
): Array<MarkdownToken> =>
  items.flatMap((item, index) => {
    if (item.indent !== baseIndent) {
      return [];
    }
    let end = index + 1;
    while ((items[end]?.indent ?? baseIndent) > baseIndent) {
      end += 1;
    }
    const nested = items.slice(index + 1, end);
    const [firstNested] = nested;
    const nestedList =
      firstNested === undefined
        ? []
        : [
            {
              type: 'list',
              ordered: true,
              start: firstNested.number,
              typeMarker: firstNested.type,
              items: nestedListItems(
                nested,
                Math.min(...nested.map(({ indent }) => indent)),
                lexer,
              ),
              raw: nested.map(({ raw }) => raw).join('\n'),
            },
          ];
    return [
      {
        type: 'list_item',
        raw: item.raw,
        tokens: [...itemTokens(item, lexer), ...nestedList],
      },
    ];
  });

export const journalOrderedListTokenizer: MarkdownTokenizer = {
  name: 'orderedList',
  level: 'block',
  start: () => -1,
  tokenize: (source, _tokens, lexer) => {
    const [items, consumed, lines] = collectItemsFromSource(source);
    const [first] = items;
    if (first === undefined) {
      return;
    }
    const listItems = nestedListItems(items, first.indent, lexer);
    if (listItems.length === 0) {
      return;
    }
    return {
      type: 'list',
      ordered: true,
      start: first.number || 1,
      typeMarker: first.type,
      items: listItems,
      raw: lines.slice(0, consumed).join('\n'),
    };
  },
};
