/** The complete day placed on the clipboard from the writing page. */

import { journalDateLabel } from './day-label.ts';
import type { JournalDate } from './journal-day.ts';
import { nestMarkdownHeadings } from './nest-markdown-headings.ts';
import {
  parseScriptureReference,
  scriptureTopicOf,
} from './scripture-reference.ts';

export type CopyableJournalDay = {
  readonly date: JournalDate;
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  /** The morning's one line: a passage, or the topic studied instead. */
  readonly scriptureReference: string;
};

const morningLine = (line: string): string => {
  if (parseScriptureReference(line) !== undefined) {
    return `Passage: ${line.trim()}`;
  }
  const topic = scriptureTopicOf(line);
  return topic === undefined ? '' : `Topic: ${topic}`;
};

const section = (
  heading: string,
  blocks: ReadonlyArray<string>,
): ReadonlyArray<string> => [
  `## ${heading}`,
  ...blocks.filter((block) => block !== ''),
];

const sectionMarkdown = (markdown: string): string =>
  markdown === '' ? '' : nestMarkdownHeadings(markdown);

/** A portable Markdown document made from the current browser draft. */
export const dayCopyMarkdown = (day: CopyableJournalDay): string =>
  `${[
    `# ${journalDateLabel(day.date)}`,
    ...section('Morning', [
      morningLine(day.scriptureReference),
      sectionMarkdown(day.scriptureMarkdown),
    ]),
    ...section('Evening', [sectionMarkdown(day.journalMarkdown)]),
  ].join('\n\n')}\n`;
