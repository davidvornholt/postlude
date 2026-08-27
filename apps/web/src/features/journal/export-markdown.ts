/** Incremental human-readable projections of authoritative export entries. */

import { stringify as stringifyYaml } from 'yaml';

import type { ExportEntry } from './export-format.ts';
import { type ExportGrouping, periodLabel } from './export-period.ts';
import { formatScriptureReference } from './scripture-reference.ts';

const minimumFenceLength = 3;

export type ExportPeriodMetadata = {
  readonly key: string;
  readonly from: string;
  readonly to: string;
  readonly days: number;
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

const markdownChunks = (markdown: string): ReadonlyArray<string> => {
  const longestSourceRun = longestBacktickRun(markdown);
  const fence = '`'.repeat(Math.max(minimumFenceLength, longestSourceRun + 1));
  const beforeClosingFence = markdown.endsWith('\n') ? '' : '\n';
  return [`${fence}markdown\n`, markdown, `${beforeClosingFence}${fence}`];
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

const frontMatter = (value: object): string => {
  const yaml = stringifyYaml(value, {
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
    lineWidth: 0,
  });
  return `---\n${yaml}---`;
};

const morningChunks = (
  entry: ExportEntry,
  heading: string,
): ReadonlyArray<string> => {
  const reference = formattedReference(entry);
  if (entry.scriptureMarkdown === '' && reference === undefined) {
    return [];
  }
  return [
    `\n\n${heading} Morning`,
    ...(reference === undefined ? [] : [`\n\nPassage: ${reference}`]),
    ...(entry.scriptureMarkdown === ''
      ? []
      : ['\n\n', ...markdownChunks(entry.scriptureMarkdown)]),
  ];
};

const eveningChunks = (
  entry: ExportEntry,
  heading: string,
): ReadonlyArray<string> =>
  entry.journalMarkdown === ''
    ? []
    : [
        `\n\n${heading} Evening`,
        '\n\n',
        ...markdownChunks(entry.journalMarkdown),
      ];

/** Chunks for one complete non-authoritative daily reading copy. */
export const entryDocumentChunks = (
  entry: ExportEntry,
): ReadonlyArray<string> => {
  const reference = formattedReference(entry);
  return [
    frontMatter({
      date: entry.date,
      ...(reference === undefined ? {} : { scripture: reference }),
    }),
    ...morningChunks(entry, '##'),
    ...eveningChunks(entry, '##'),
    '\n',
  ];
};

/** Complete daily text for format-level compatibility assertions. */
export const entryDocument = (entry: ExportEntry): string =>
  entryDocumentChunks(entry).join('');

/** The small prefix known before an aggregated ZIP member starts. */
export const periodHeaderChunks = (
  grouping: ExportGrouping,
  period: ExportPeriodMetadata,
): ReadonlyArray<string> => [
  frontMatter({
    period: period.key,
    from: period.from,
    to: period.to,
    days: period.days,
  }),
  `\n\n# ${periodLabel(grouping, period.key)}`,
];

/** One day appended to an already-open aggregated ZIP member. */
export const periodEntryChunks = (
  entry: ExportEntry,
): ReadonlyArray<string> => [
  `\n\n## ${entry.date}`,
  ...morningChunks(entry, '###'),
  ...eveningChunks(entry, '###'),
];
