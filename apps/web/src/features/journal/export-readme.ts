import {
  type ExportMetadata,
  entriesPath,
  exportEntriesMediaType,
  exportFormatVersion,
  exportManifestMediaType,
  journalDayStartsAt,
  manifestPath,
} from './export-format.ts';

const days = (count: number): string =>
  count === 1 ? '1 day' : `${count} days`;

/** Documentation that travels with the archive and does not hard-wrap prose. */
export const exportReadme = (metadata: ExportMetadata): string =>
  [
    '# Postlude journal export',
    `This archive was created at ${metadata.exportedAt} and contains ${days(metadata.entryCount)} with current meaningful content as of journal day ${metadata.journalDate}.`,
    '## Authoritative data',
    `\`${manifestPath}\` is the manifest for version ${exportFormatVersion} of \`${exportManifestMediaType}\`. It records the export instant, journal date, entry count, and journal-day rules.`,
    `\`${entriesPath}\` uses \`${exportEntriesMediaType}\`. Each UTF-8 line is one JSON object followed by a line feed. JSON escaping preserves every stored Markdown code point and newline when parsed. The records also carry the structured scripture reference, the independent first-use timestamps for both sections, and the row creation and update timestamps.`,
    'Only days with current meaningful content are present. A day qualifies when its evening word count is positive, its morning word count is positive, or it has a scripture reference. A cleared row and a row that was never meaningfully written are omitted.',
    '## Journal days',
    `The configured IANA time zone is \`${metadata.timeZone}\`. A journal day starts at ${journalDayStartsAt} in that zone, so an instant before ${journalDayStartsAt} belongs to the calendar day that is ending. The stored journal date, rather than an inferred UTC date, is authoritative across daylight-saving changes and travel.`,
    '## Markdown projections',
    'The files under `days/YYYY/YYYY-MM-DD.md` are non-authoritative reading copies. Their YAML front matter quotes string values. Morning and Evening Markdown are shown inside separate backtick fences that are longer than any backtick run in the stored source, so an unclosed construct in one section cannot consume the other section. Use `entries.ndjson` for exact recovery or re-import.',
  ]
    .join('\n\n')
    .concat('\n');
