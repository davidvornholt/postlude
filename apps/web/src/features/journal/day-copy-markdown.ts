/** The complete day placed on the clipboard from the writing page. */

import { journalDateLabel } from './day-label.ts';
import type { JournalDate } from './journal-day.ts';

export type CopyableJournalDay = {
  readonly date: JournalDate;
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  readonly scriptureReference: string;
};

const section = (
  heading: string,
  blocks: ReadonlyArray<string>,
): ReadonlyArray<string> => [
  `## ${heading}`,
  ...blocks.filter((block) => block !== ''),
];

const sectionHeadingDepth = 2;
const deepestMarkdownHeading = 6;

const fenceLinePattern =
  /^(?<indent> {0,3})(?<marker>`{3,}|~{3,})(?<info>.*)$/u;
const closingFencePattern = /^(?<indent> {0,3})(?<marker>`{3,}|~{3,})[ \t]*$/u;
const headingLinePattern =
  /^(?<indent> {0,3})(?<hashes>#{1,6})(?:(?<spacing>[ \t]+)(?<text>.*))?$/u;

type MarkdownFence = {
  readonly character: '`' | '~';
  readonly length: number;
};

const withoutCarriageReturn = (line: string): string =>
  line.endsWith('\r') ? line.slice(0, -1) : line;

const carriageReturnOf = (line: string): '' | '\r' =>
  line.endsWith('\r') ? '\r' : '';

const closingFence = (line: string, fence: MarkdownFence): boolean => {
  const match = closingFencePattern.exec(line);
  const marker = match?.groups?.marker;
  const [character = ''] = marker ?? '';
  return (
    marker !== undefined &&
    character === fence.character &&
    marker.length >= fence.length
  );
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

  const fenceMatch = fenceLinePattern.exec(content);
  const marker = fenceMatch?.groups?.marker;
  const info = fenceMatch?.groups?.info;
  if (marker !== undefined && info !== undefined) {
    const character = marker.startsWith('`') ? '`' : '~';
    return {
      fence:
        character !== '`' || !info.includes('`')
          ? { character, length: marker.length }
          : undefined,
      line,
    };
  }

  const groups = headingLinePattern.exec(content)?.groups;
  const indent = groups?.indent;
  const hashes = groups?.hashes;
  if (indent === undefined || hashes === undefined) {
    return { fence, line };
  }
  const { spacing = ' ', text = '' } = groups ?? {};

  const level = Math.min(
    hashes.length + sectionHeadingDepth,
    deepestMarkdownHeading,
  );
  return {
    fence,
    line: `${indent}${'#'.repeat(level)}${spacing}${text}${carriageReturn}`,
  };
};

/** Nests headings without asking the Markdown parser to rewrite the document. */
const nestHeadingsBelowSection = (markdown: string): string => {
  let fence: MarkdownFence | undefined;
  return markdown
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

const sectionMarkdown = (markdown: string): string =>
  markdown === '' ? '' : nestHeadingsBelowSection(markdown);

/** A portable Markdown document made from the current browser draft. */
export const dayCopyMarkdown = (day: CopyableJournalDay): string =>
  `${[
    `# ${journalDateLabel(day.date)}`,
    ...section('Morning', [
      day.scriptureReference === '' ? '' : `Passage: ${day.scriptureReference}`,
      sectionMarkdown(day.scriptureMarkdown),
    ]),
    ...section('Evening', [sectionMarkdown(day.journalMarkdown)]),
  ].join('\n\n')}\n`;
