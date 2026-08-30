const sectionHeadingDepth = 2;
const deepestMarkdownHeading = 6;
const minimumIndentedCodeSpacing = 5;

const fenceLinePattern =
  /^(?<prefix>(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-+*]|\d+[.)])[ \t]+))*)(?<indent> {0,3})(?<marker>`{3,}|~{3,})(?<info>.*)$/u;
const closingFencePattern =
  /^(?<prefix>(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-+*]|\d+[.)])[ \t]+))*)(?<indent> {0,3})(?<marker>`{3,}|~{3,})[ \t]*$/u;
const headingLinePattern =
  /^(?<prefix>(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-+*]|\d+[.)])[ \t]+))*)(?<indent> {0,3})(?<hashes>#{1,6})(?:(?<spacing>[ \t]+)(?<text>.*))?$/u;
const setextUnderlinePattern =
  /^(?<prefix>(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-+*]|\d+[.)])[ \t]+))*)(?<indent> {0,3})(?<marker>=+|-+)[ \t]*$/u;
const setextTextPattern =
  /^(?<prefix>(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-+*]|\d+[.)])[ \t]+))*)(?<indent> {0,3})(?<text>\S(?:.*?\S)?)[ \t]*$/u;
const listMarkerSpacingPattern =
  /(?:^|[ \t>])(?:[-+*]|\d+[.)])(?<spacing>[ \t]+)/gu;
type MarkdownFence = {
  readonly character: '`' | '~';
  readonly length: number;
  readonly prefix: string;
};
const withoutCarriageReturn = (line: string): string =>
  line.endsWith('\r') ? line.slice(0, -1) : line;

const carriageReturnOf = (line: string): '' | '\r' =>
  line.endsWith('\r') ? '\r' : '';
const hasIndentedCodeListPrefix = (prefix: string): boolean => {
  for (const match of prefix.matchAll(listMarkerSpacingPattern)) {
    if ((match.groups?.spacing ?? '').length >= minimumIndentedCodeSpacing) {
      return true;
    }
  }
  return false;
};
const closingFence = (line: string, fence: MarkdownFence): boolean => {
  const match = closingFencePattern.exec(line);
  const prefix = match?.groups?.prefix;
  const marker = match?.groups?.marker;
  const [character = ''] = marker ?? '';
  return (
    prefix !== undefined &&
    marker !== undefined &&
    (prefix === '' ||
      prefix === fence.prefix ||
      fence.prefix.startsWith(prefix)) &&
    character === fence.character &&
    marker.length >= fence.length
  );
};

const openingFence = (line: string): MarkdownFence | undefined => {
  const match = fenceLinePattern.exec(line);
  const prefix = match?.groups?.prefix;
  const marker = match?.groups?.marker;
  const info = match?.groups?.info;
  if (prefix === undefined || marker === undefined || info === undefined) {
    return undefined;
  }
  const character = marker.startsWith('`') ? '`' : '~';
  return character === '`' && info.includes('`')
    ? undefined
    : { character, length: marker.length, prefix };
};
const nestMarkdownLine = (
  line: string,
  fence: MarkdownFence | undefined,
): { readonly fence: MarkdownFence | undefined; readonly line: string } => {
  const content = withoutCarriageReturn(line);
  const carriageReturn = carriageReturnOf(line);

  if (fence !== undefined) {
    return {
      fence: closingFence(content, fence) ? undefined : fence,
      line,
    };
  }

  const openedFence = openingFence(content);
  if (openedFence !== undefined) {
    return {
      fence: openedFence,
      line,
    };
  }

  const groups = headingLinePattern.exec(content)?.groups;
  const prefix = groups?.prefix;
  const indent = groups?.indent;
  const hashes = groups?.hashes;
  if (prefix === undefined || indent === undefined || hashes === undefined) {
    return { fence, line };
  }
  if (hasIndentedCodeListPrefix(prefix)) {
    return { fence, line };
  }
  const { spacing = ' ', text = '' } = groups ?? {};

  const level = Math.min(
    hashes.length + sectionHeadingDepth,
    deepestMarkdownHeading,
  );
  return {
    fence,
    line: `${prefix}${indent}${'#'.repeat(level)}${spacing}${text}${carriageReturn}`,
  };
};
type MarkdownSourceLine = {
  readonly sourceIndex: number;
  line: string;
};
const replaceSetextHeading = (
  output: Array<MarkdownSourceLine>,
  sourceIndex: number,
  line: string,
): boolean => {
  const underlineGroups = setextUnderlinePattern.exec(
    withoutCarriageReturn(line),
  )?.groups;
  const marker = underlineGroups?.marker;
  const underlinePrefix = underlineGroups?.prefix;
  const underlineIndent = underlineGroups?.indent;
  const previous = output.at(-1);
  if (
    marker === undefined ||
    previous === undefined ||
    previous.sourceIndex !== sourceIndex - 1
  ) {
    return false;
  }

  const previousGroups = setextTextPattern.exec(
    withoutCarriageReturn(previous.line),
  )?.groups;
  const prefix = previousGroups?.prefix;
  const indent = previousGroups?.indent;
  const text = previousGroups?.text;
  if (prefix === undefined || indent === undefined || text === undefined) {
    return false;
  }
  if (
    underlinePrefix !== prefix ||
    underlineIndent !== indent ||
    hasIndentedCodeListPrefix(prefix)
  ) {
    return false;
  }

  const level = marker.startsWith('=') ? 1 : 2;
  const previousCarriageReturn = carriageReturnOf(previous.line);
  previous.line = `${prefix}${indent}${'#'.repeat(level)} ${text}${previousCarriageReturn}`;
  return true;
};
type MarkdownLine = {
  readonly line: string;
  readonly sourceIndex: number;
};
const normalizeSetextHeadings = (markdown: string): string => {
  let fence: MarkdownFence | undefined;
  const output: Array<MarkdownLine> = [];

  for (const [sourceIndex, line] of markdown.split('\n').entries()) {
    const content = withoutCarriageReturn(line);
    if (fence === undefined) {
      const openedFence = openingFence(content);
      if (openedFence !== undefined) {
        fence = openedFence;
        output.push({ line, sourceIndex });
      } else if (!replaceSetextHeading(output, sourceIndex, line)) {
        output.push({ line, sourceIndex });
      }
    } else {
      if (closingFence(content, fence)) {
        fence = undefined;
      }
      output.push({ line, sourceIndex });
    }
  }

  return output.map(({ line }) => line).join('\n');
};

/** Nests headings without asking the Markdown parser to rewrite the document. */
export const nestMarkdownHeadings = (markdown: string): string => {
  let fence: MarkdownFence | undefined;
  return normalizeSetextHeadings(markdown)
    .split('\n')
    .map((line) => {
      const { fence: nextFence, line: nestedLine } = nestMarkdownLine(
        line,
        fence,
      );
      fence = nextFence;
      return nestedLine;
    })
    .join('\n');
};
