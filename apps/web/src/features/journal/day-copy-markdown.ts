/** The complete day placed on the clipboard from the writing page. */

import type { JSONContent } from '@tiptap/core';

import { journalDateLabel } from './day-label.ts';
import type { JournalDate } from './journal-day.ts';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';

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

const nestHeadingsBelowSection = (node: JSONContent): JSONContent => {
  const nested =
    node.content === undefined
      ? node
      : { ...node, content: node.content.map(nestHeadingsBelowSection) };
  if (nested.type !== 'heading') {
    return nested;
  }
  const level = nested.attrs?.level;
  return {
    ...nested,
    attrs: {
      ...nested.attrs,
      level: Math.min(
        typeof level === 'number'
          ? level + sectionHeadingDepth
          : deepestMarkdownHeading,
        deepestMarkdownHeading,
      ),
    },
  };
};

const sectionMarkdown = (markdown: string): string =>
  markdown === ''
    ? ''
    : serializeJournalMarkdown(
        nestHeadingsBelowSection(parseJournalMarkdown(markdown)),
      );

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
