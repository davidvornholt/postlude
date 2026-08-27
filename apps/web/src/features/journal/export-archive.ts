/** Named files that make the authoritative export useful without Postlude. */

import {
  type ExportMetadata,
  manifestDocument,
  manifestPath,
} from './export-format.ts';
import { type ExportGrouping, periodPath } from './export-period.ts';
import { exportReadme } from './export-readme.ts';
import { isJournalDate } from './journal-day.ts';

export type ExportFile = {
  /** Safe path inside the export, with `/` separators. */
  readonly path: string;
  readonly text: string;
};

export type ExportContext = Omit<ExportMetadata, 'entryCount'>;

const readmePath = 'README.md';

const checkedDate = (date: string): string => {
  if (!isJournalDate(date)) {
    throw new TypeError(
      `Cannot put an invalid journal date in an export: ${date}`,
    );
  }
  return date;
};

export const entryPath = (date: string): string =>
  periodPath('day', checkedDate(date));

export const manifestFile = (metadata: ExportMetadata): ExportFile => ({
  path: manifestPath,
  text: manifestDocument(metadata),
});

export const readmeFile = (
  metadata: ExportMetadata,
  grouping: ExportGrouping,
): ExportFile => ({ path: readmePath, text: exportReadme(metadata, grouping) });

const groupingNames: Record<ExportGrouping, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
};

/** Stable day-based name that distinguishes each Markdown projection. */
export const exportFileName = (
  journalDate: string,
  grouping: ExportGrouping = 'day',
): string =>
  `postlude-${checkedDate(journalDate)}-${groupingNames[grouping]}.zip`;
