/** Streams the canonical export files over one database snapshot. */

import { Effect } from 'effect';

import {
  type ExportContext,
  entryFile,
  manifestFile,
  readmeFile,
} from '../export-archive.ts';
import type { ExportMetadata } from '../export-format.ts';
import { entriesPath, entryRecordLine } from '../export-format.ts';
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

const writeArchive = (
  zip: StreamingZip,
  exports: EntryExport,
  timeZone: string,
  observeContext: ObserveExportContext,
) => {
  let context: ExportContext | undefined;
  let metadata: ExportMetadata | undefined;
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
      {
        before: Effect.suspend(() =>
          metadata === undefined
            ? Effect.dieMessage('The export snapshot context was not observed.')
            : zip.addFile(readmeFile(metadata)),
        ),
        onEntry: (entry) => zip.addFile(entryFile(entry)),
        after: Effect.void,
      },
    ],
  });
};

export const exportArchiveStream = (
  exports: EntryExport,
  timeZone: string,
  observeContext: ObserveExportContext,
) =>
  streamingZip((zip) => writeArchive(zip, exports, timeZone, observeContext));

export const journalExportStream = (
  timeZone: string,
  observeContext: ObserveExportContext,
) =>
  streamingZip((zip) =>
    Effect.gen(function* () {
      const exports = yield* EntryExport;
      yield* writeArchive(zip, exports, timeZone, observeContext);
    }),
  );
