/** Streams the canonical export files over one database snapshot. */

import { Effect } from 'effect';

import {
  type ExportContext,
  entryPath,
  manifestFile,
  readmeFile,
} from '../export-archive.ts';
import type { ExportEntry, ExportMetadata } from '../export-format.ts';
import { entriesPath, entryRecordLine } from '../export-format.ts';
import {
  type ExportPeriodMetadata,
  entryDocumentChunks,
  periodEntryChunks,
  periodHeaderChunks,
} from '../export-markdown.ts';
import { type ExportGrouping, periodPath } from '../export-period.ts';
import { journalDateAt } from '../journal-day.ts';
import type { ExportSnapshot } from './entry-export.ts';
import { EntryExport } from './entry-export.ts';
import { type StreamingZip, streamingZip } from './streaming-zip.ts';

type ObserveExportContext = (context: ExportContext) => void;

export const exportContextAt = (
  snapshot: ExportSnapshot,
  timeZone: string,
): ExportContext => ({
  exportedAt: snapshot.exportedAt,
  journalDate: journalDateAt(new Date(snapshot.exportedAt), timeZone),
  timeZone,
});

type WriteArchiveOptions = {
  readonly zip: StreamingZip;
  readonly exports: EntryExport;
  readonly timeZone: string;
  readonly observeContext: ObserveExportContext;
  readonly grouping: ExportGrouping;
};

const writeChunks = (zip: StreamingZip, chunks: ReadonlyArray<string>) =>
  Effect.forEach(chunks, (chunk) => zip.writeText(chunk), { discard: true });

const writeDailyEntry = (zip: StreamingZip, entry: ExportEntry) =>
  zip
    .beginFile(entryPath(entry.date))
    .pipe(
      Effect.zipRight(writeChunks(zip, entryDocumentChunks(entry))),
      Effect.zipRight(zip.endFile),
    );

const beginPeriod = (
  zip: StreamingZip,
  grouping: Exclude<ExportGrouping, 'day'>,
  period: ExportPeriodMetadata,
) =>
  zip
    .beginFile(periodPath(grouping, period.key))
    .pipe(
      Effect.zipRight(writeChunks(zip, periodHeaderChunks(grouping, period))),
    );

const writeArchive = ({
  zip,
  exports,
  timeZone,
  observeContext,
  grouping,
}: WriteArchiveOptions) => {
  let context: ExportContext | undefined;
  let metadata: ExportMetadata | undefined;
  const addReadme = () =>
    metadata === undefined
      ? Effect.dieMessage('The export snapshot context was not observed.')
      : zip.addFile(readmeFile(metadata, grouping));
  const dailyPass =
    grouping === 'day'
      ? {
          before: Effect.suspend(addReadme),
          onEntry: (entry: ExportEntry) => writeDailyEntry(zip, entry),
          after: Effect.void,
        }
      : undefined;
  const periodPass =
    grouping === 'day'
      ? undefined
      : {
          grouping,
          before: Effect.suspend(addReadme),
          onPeriodStart: (period: ExportPeriodMetadata) =>
            beginPeriod(zip, grouping, period),
          onEntry: (entry: ExportEntry) =>
            writeChunks(zip, periodEntryChunks(entry)),
          onPeriodEnd: zip.writeText('\n').pipe(Effect.zipRight(zip.endFile)),
          after: Effect.void,
        };
  return exports.visit({
    onSnapshot: (snapshot) =>
      Effect.sync(() => {
        context = exportContextAt(snapshot, timeZone);
        observeContext(context);
      }),
    onCount: (entryCount) => {
      const observed = context;
      if (observed === undefined) {
        return Effect.dieMessage(
          'The export snapshot context was not observed.',
        );
      }
      metadata = { ...observed, entryCount };
      return zip.addFile(manifestFile(metadata));
    },
    passes: [
      {
        before: zip.beginFile(entriesPath),
        onEntry: (entry) => zip.writeText(entryRecordLine(entry)),
        after: zip.endFile,
      },
      ...(dailyPass === undefined ? [] : [dailyPass]),
    ],
    ...(periodPass === undefined ? {} : { periodPass }),
  });
};

export const exportArchiveStream = (
  exports: EntryExport,
  timeZone: string,
  observeContext: ObserveExportContext,
  grouping: ExportGrouping = 'day',
) =>
  streamingZip((zip) =>
    writeArchive({ zip, exports, timeZone, observeContext, grouping }),
  );

export const journalExportStream = (
  timeZone: string,
  observeContext: ObserveExportContext,
  grouping: ExportGrouping = 'day',
) =>
  streamingZip((zip) =>
    Effect.gen(function* () {
      const exports = yield* EntryExport;
      yield* writeArchive({
        zip,
        exports,
        timeZone,
        observeContext,
        grouping,
      });
    }),
  );
