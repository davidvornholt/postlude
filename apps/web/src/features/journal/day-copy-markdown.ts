/** The complete day placed on the clipboard from the writing page. */

import { journalDateLabel } from './day-label.ts';
import type { JournalDate } from './journal-day.ts';
import { nestMarkdownHeadings } from './nest-markdown-headings.ts';

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

const sectionMarkdown = (markdown: string): string =>
  markdown === '' ? '' : nestMarkdownHeadings(markdown);

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
