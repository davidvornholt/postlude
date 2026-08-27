/** The authoritative, versioned part of a journal export. */

import { Schema } from 'effect';

import { isTimeZone } from '#/shared/time-zone.ts';
import { JournalDateSchema } from './schemas/entry.ts';

export const exportFormatVersion = 1;
export const exportManifestMediaType =
  'application/vnd.postlude.journal-export+json';
export const exportEntriesMediaType = 'application/x-ndjson';
export const manifestPath = 'manifest.json';
export const entriesPath = 'entries.ndjson';
export const journalDayStartsAt = '04:00';

const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u;
const millisecondTimestampEnd = 23;
const positiveInteger = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0));
const optionalPositiveInteger = Schema.NullOr(positiveInteger);

export const UtcTimestampSchema = Schema.String.pipe(
  Schema.pattern(utcTimestampPattern),
  Schema.filter(
    (value) => {
      const milliseconds = `${value.slice(0, millisecondTimestampEnd)}Z`;
      const instant = new Date(milliseconds);
      return (
        !Number.isNaN(instant.getTime()) &&
        instant.toISOString() === milliseconds
      );
    },
    {
      identifier: 'UtcTimestamp',
      description: 'a valid UTC timestamp with six fractional digits',
    },
  ),
);

const IanaTimeZoneSchema = Schema.String.pipe(
  Schema.filter(isTimeZone, {
    identifier: 'TimeZone',
    description: 'an IANA time zone resolvable by the platform',
  }),
);

export const ExportManifestSchema = Schema.Struct({
  mediaType: Schema.Literal(exportManifestMediaType),
  version: Schema.Literal(exportFormatVersion),
  exportedAt: UtcTimestampSchema,
  journalDate: JournalDateSchema,
  journalDay: Schema.Struct({
    timeZone: IanaTimeZoneSchema,
    startsAt: Schema.Literal(journalDayStartsAt),
  }),
  entries: Schema.Struct({
    path: Schema.Literal(entriesPath),
    mediaType: Schema.Literal(exportEntriesMediaType),
    count: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
});

const ExportScriptureReferenceSchema = Schema.Struct({
  book: Schema.String.pipe(Schema.minLength(1)),
  chapter: positiveInteger,
  verseStart: optionalPositiveInteger,
  verseEnd: optionalPositiveInteger,
}).pipe(
  Schema.filter(
    (reference) =>
      reference.verseEnd === null ||
      (reference.verseStart !== null &&
        reference.verseEnd >= reference.verseStart),
    {
      identifier: 'ExportScriptureReference',
      description: 'a chapter, verse, or ordered verse-range reference',
    },
  ),
);

export const ExportEntrySchema = Schema.Struct({
  date: JournalDateSchema,
  journalMarkdown: Schema.String,
  scriptureMarkdown: Schema.String,
  scriptureReference: Schema.NullOr(ExportScriptureReferenceSchema),
  journalFirstUsedAt: Schema.NullOr(UtcTimestampSchema),
  scriptureFirstUsedAt: Schema.NullOr(UtcTimestampSchema),
  createdAt: UtcTimestampSchema,
  updatedAt: UtcTimestampSchema,
});

export type ExportManifest = Schema.Schema.Type<typeof ExportManifestSchema>;
export type ExportEntry = Schema.Schema.Type<typeof ExportEntrySchema>;

export type ExportMetadata = {
  readonly exportedAt: string;
  readonly journalDate: string;
  readonly timeZone: string;
  readonly entryCount: number;
};

const exactParseOptions = { onExcessProperty: 'error' } as const;
const decodeManifest = Schema.decodeUnknownSync(
  ExportManifestSchema,
  exactParseOptions,
);
const decodeEntry = Schema.decodeUnknownSync(ExportEntrySchema);
const decodeExactEntry = Schema.decodeUnknownSync(
  ExportEntrySchema,
  exactParseOptions,
);

const parseJson = (text: string): unknown => JSON.parse(text);

export const manifestDocument = (metadata: ExportMetadata): string => {
  const manifest = decodeManifest({
    mediaType: exportManifestMediaType,
    version: exportFormatVersion,
    exportedAt: metadata.exportedAt,
    journalDate: metadata.journalDate,
    journalDay: {
      timeZone: metadata.timeZone,
      startsAt: journalDayStartsAt,
    },
    entries: {
      path: entriesPath,
      mediaType: exportEntriesMediaType,
      count: metadata.entryCount,
    },
  });
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

/** One compact JSON record and its NDJSON line feed. */
export const entryRecordLine = (entry: ExportEntry): string =>
  `${JSON.stringify(decodeEntry(entry))}\n`;

export const entriesDocument = (entries: ReadonlyArray<ExportEntry>): string =>
  entries.map(entryRecordLine).join('');

export const parseManifestDocument = (text: string): ExportManifest =>
  decodeManifest(parseJson(text));

export const parseEntryRecord = (text: string): ExportEntry =>
  decodeExactEntry(parseJson(text));

export const parseEntriesDocument = (
  text: string,
): ReadonlyArray<ExportEntry> => {
  if (text === '') {
    return [];
  }
  if (!text.endsWith('\n')) {
    throw new TypeError(
      'entries.ndjson must end every record with a line feed.',
    );
  }
  const lines = text.slice(0, -1).split('\n');
  if (lines.some((line) => line === '')) {
    throw new TypeError('entries.ndjson cannot contain blank record lines.');
  }
  return lines.map(parseEntryRecord);
};
