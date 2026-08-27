import {
  type ExportMetadata,
  entriesPath,
  exportEntriesMediaType,
  exportFormatVersion,
  exportManifestMediaType,
  journalDayStartsAt,
  manifestPath,
} from './export-format.ts';
import type { ExportGrouping } from './export-period.ts';
import { journalCountLabel } from './journal-labels.ts';

const projectionDescriptions: Record<ExportGrouping, string> = {
  day: 'The files under `days/YYYY/YYYY-MM-DD.md` contain one journal day each. This is the closest reading-copy layout to Postlude’s day-by-day journal.',
  week: 'The files under `weeks/YYYY/YYYY-Www.md` gather each ISO 8601 week. ISO weeks run Monday to Sunday and belong to the ISO week-numbering year that contains their Thursday, so a week across New Year stays whole.',
  month: 'The files under `months/YYYY/YYYY-MM.md` gather each calendar month.',
  year: 'The `YYYY.md` files at the top of the archive gather each calendar year. There is no redundant folder containing only one year file.',
};

const projectionFormat: Record<ExportGrouping, string> = {
  day: 'Each daily file has quoted YAML front matter for its date and optional passage, followed by Morning and Evening sections.',
  week: 'Each weekly file has quoted YAML front matter for its period key, first day, last day, and day count. Its journal days appear under dated headings with Morning and Evening subsections.',
  month:
    'Each monthly file has quoted YAML front matter for its period key, first day, last day, and day count. Its journal days appear under dated headings with Morning and Evening subsections.',
  year: 'Each yearly file has quoted YAML front matter for its period key, first day, last day, and day count. Its journal days appear under dated headings with Morning and Evening subsections.',
};

/** Documentation that travels with the archive and does not hard-wrap prose. */
export const exportReadme = (
  metadata: ExportMetadata,
  grouping: ExportGrouping = 'day',
): string =>
  [
    '# Postlude journal export',
    `This archive was created at ${metadata.exportedAt} and contains ${journalCountLabel(metadata.entryCount, 'day')} with recoverable stored content as of journal day ${metadata.journalDate}.`,
    '## Authoritative data',
    `\`${manifestPath}\` is the manifest for version ${exportFormatVersion} of \`${exportManifestMediaType}\`. It records the export instant, journal date, entry count, and journal-day rules.`,
    `\`${entriesPath}\` uses \`${exportEntriesMediaType}\`. Each UTF-8 line is one JSON object followed by a line feed. JSON escaping preserves every stored Markdown code point and newline when parsed. The records also carry the structured scripture reference, the independent first-use timestamps for both sections, and the row creation and update timestamps.`,
    'Only days with recoverable stored content are present. A day qualifies when either stored Markdown string is not empty or it has a scripture reference. Markdown structure and whitespace remain exact content. Empty, fully cleared, and provenance-only rows are omitted.',
    '## Journal days',
    `The configured IANA time zone is \`${metadata.timeZone}\`. A journal day starts at ${journalDayStartsAt} in that zone, so an instant before ${journalDayStartsAt} belongs to the calendar day that is ending. The stored journal date, rather than an inferred UTC date, is authoritative across daylight-saving changes and travel.`,
    '## Markdown projections',
    `${projectionDescriptions[grouping]} ${projectionFormat[grouping]} These Markdown files are non-authoritative reading copies. Stored source is enclosed in backtick fences longer than any backtick run in that source. Use \`${entriesPath}\` for exact recovery or re-import, regardless of the chosen reading-copy grouping.`,
  ]
    .join('\n\n')
    .concat('\n');
