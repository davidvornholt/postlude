/** Named files that make the authoritative export useful without Postlude. */

import { stringify as stringifyYaml } from 'yaml';

import {
  type ExportEntry,
  type ExportMetadata,
  entriesDocument,
  entriesPath,
  manifestDocument,
  manifestPath,
} from './export-format.ts';
import { exportReadme } from './export-readme.ts';
import { isJournalDate } from './journal-day.ts';
import { formatScriptureReference } from './scripture-reference.ts';

export type ExportFile = {
  /** Safe path inside the export, with `/` separators. */
  readonly path: string;
  readonly text: string;
};

export type ExportContext = Omit<ExportMetadata, 'entryCount'>;

const yearLength = 4;
const minimumFenceLength = 3;
const readmePath = 'README.md';

const checkedDate = (date: string): string => {
  if (!isJournalDate(date)) {
    throw new TypeError(
      `Cannot put an invalid journal date in an export: ${date}`,
    );
  }
  return date;
};

export const entryPath = (date: string): string => {
  const safeDate = checkedDate(date);
  return `days/${safeDate.slice(0, yearLength)}/${safeDate}.md`;
};

const longestBacktickRun = (markdown: string): number => {
  let longest = 0;
  let current = 0;
  for (const character of markdown) {
    if (character === '`') {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
};

const markdownFence = (markdown: string): string => {
  const longestSourceRun = longestBacktickRun(markdown);
  const fence = '`'.repeat(Math.max(minimumFenceLength, longestSourceRun + 1));
  const beforeClosingFence = markdown.endsWith('\n') ? '' : '\n';
  return `${fence}markdown\n${markdown}${beforeClosingFence}${fence}`;
};

const formattedReference = (entry: ExportEntry): string | undefined => {
  const reference = entry.scriptureReference;
  if (reference === null) {
    return undefined;
  }
  return formatScriptureReference({
    book: reference.book,
    chapter: reference.chapter,
    ...(reference.verseStart === null
      ? {}
      : { verseStart: reference.verseStart }),
    ...(reference.verseEnd === null ? {} : { verseEnd: reference.verseEnd }),
  });
};

const frontMatter = (entry: ExportEntry): string => {
  const reference = formattedReference(entry);
  const yaml = stringifyYaml(
    {
      date: entry.date,
      ...(reference === undefined ? {} : { scripture: reference }),
    },
    {
      defaultKeyType: 'PLAIN',
      defaultStringType: 'QUOTE_DOUBLE',
      lineWidth: 0,
    },
  );
  return `---\n${yaml}---`;
};

const morningSection = (entry: ExportEntry): ReadonlyArray<string> => {
  const reference = formattedReference(entry);
  if (entry.scriptureMarkdown === '' && reference === undefined) {
    return [];
  }
  return [
    '## Morning',
    ...(reference === undefined ? [] : [`Passage: ${reference}`]),
    ...(entry.scriptureMarkdown === ''
      ? []
      : [markdownFence(entry.scriptureMarkdown)]),
  ];
};

const eveningSection = (entry: ExportEntry): ReadonlyArray<string> =>
  entry.journalMarkdown === ''
    ? []
    : ['## Evening', markdownFence(entry.journalMarkdown)];

/** One non-authoritative reading copy of a machine entry. */
export const entryDocument = (entry: ExportEntry): string =>
  [frontMatter(entry), ...morningSection(entry), ...eveningSection(entry)]
    .join('\n\n')
    .concat('\n');

export const manifestFile = (metadata: ExportMetadata): ExportFile => ({
  path: manifestPath,
  text: manifestDocument(metadata),
});

export const entriesFile = (
  entries: ReadonlyArray<ExportEntry>,
): ExportFile => ({ path: entriesPath, text: entriesDocument(entries) });

export const readmeFile = (metadata: ExportMetadata): ExportFile => ({
  path: readmePath,
  text: exportReadme(metadata),
});

export const entryFile = (entry: ExportEntry): ExportFile => ({
  path: entryPath(entry.date),
  text: entryDocument(entry),
});

export const exportFiles = (
  entries: ReadonlyArray<ExportEntry>,
  context: ExportContext,
): ReadonlyArray<ExportFile> => {
  const metadata = { ...context, entryCount: entries.length };
  return [
    manifestFile(metadata),
    entriesFile(entries),
    readmeFile(metadata),
    ...entries.map(entryFile),
  ];
};

/** Stable day-based download name. Same-day exports intentionally replace. */
export const exportFileName = (journalDate: string): string =>
  `postlude-${checkedDate(journalDate)}.zip`;
