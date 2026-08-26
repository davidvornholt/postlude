/**
 * The journal as a folder of markdown files, for taking out of the app.
 *
 * The point of an export is that it outlives the thing that made it, so the
 * files are plain markdown with YAML front matter — what a notes app reads, what
 * a text editor shows, and what a person can still make sense of years from now
 * with no tool at all. Nothing here knows about zip: it turns entries into named
 * documents, and the caller decides what container they travel in.
 *
 * The layout is one file per day, `2026/2026-08-26.md`, foldered by year so a
 * long journal opens as a handful of folders rather than as one listing of
 * thousands. The name sorts chronologically on its own, in every file browser,
 * without depending on a timestamp the copy might not survive.
 */

import type { JournalEntry } from './schemas/entry.ts';
import { formatScriptureReference } from './scripture-reference.ts';

export type ExportFile = {
  /** Path inside the export, with `/` separators. */
  readonly path: string;
  readonly text: string;
};

const yearLength = 4;

/**
 * Front matter carries what the prose cannot say for itself: which day the file
 * is, and which passage the morning was. The reference is written in the house
 * style rather than as the four columns it is stored as, because that is the
 * form a reader recognises and the form the app's own parser reads back.
 */
const frontMatter = (entry: JournalEntry): string => {
  const reference = entry.scriptureReference;
  return [
    '---',
    `date: ${entry.date}`,
    ...(reference === undefined
      ? []
      : [`scripture: ${formatScriptureReference(reference)}`]),
    '---',
  ].join('\n');
};

/**
 * A section appears when it holds something and is left out when it does not, so
 * a file never carries an empty heading. A day written only in the evening is
 * its prose under one heading; a day where only the passage was noted is that.
 */
const section = (heading: string, markdown: string): ReadonlyArray<string> =>
  markdown.trim() === '' ? [] : [`## ${heading}`, markdown.trim()];

/** One day as the file it is exported as. */
export const entryDocument = (entry: JournalEntry): string =>
  [
    frontMatter(entry),
    ...section('Morning', entry.scriptureMarkdown),
    ...section('Evening', entry.journalMarkdown),
  ]
    .join('\n\n')
    .concat('\n');

/**
 * What the export says about itself. An export that needs the app to explain it
 * is not an export, so the format is written down inside it rather than in a
 * document that stays behind.
 */
const readme = (count: number, today: string): string =>
  `# Postlude journal

Exported on ${today}. ${count === 1 ? '1 day' : `${count} days`}, one markdown file each, under a folder per year.

Each file opens with YAML front matter carrying the journal day it is for and,
where one was noted, the morning's passage in the form \`Proverbs 12:5-13\`.
Below it, a \`## Morning\` section holds what was written about the passage and a
\`## Evening\` section holds the evening's own writing. A section that was never
written is left out rather than left empty.

The journal day runs from 04:00 to 04:00 local time, so something written at one
in the morning belongs to the day that is ending rather than to the one that has
just begun. The date in the file name and in the front matter is that journal
day, not a timestamp.
`;

/**
 * Every file the export contains, in the order they are written. `today` is the
 * journal day the export was taken on, which is decided by the server rather
 * than read from a clock here.
 */
export const exportFiles = (
  entries: ReadonlyArray<JournalEntry>,
  today: string,
): ReadonlyArray<ExportFile> => [
  { path: 'README.md', text: readme(entries.length, today) },
  ...entries.map((entry) => ({
    path: `${entry.date.slice(0, yearLength)}/${entry.date}.md`,
    text: entryDocument(entry),
  })),
];

/** What the browser saves it as, dated so two exports never collide. */
export const exportFileName = (today: string): string =>
  `postlude-${today}.zip`;
