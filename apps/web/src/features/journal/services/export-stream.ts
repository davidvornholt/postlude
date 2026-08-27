/** Streams the canonical export files over one database snapshot. */

import { Effect } from 'effect';

import {
  type ExportContext,
  entryFile,
  manifestFile,
  readmeFile,
} from '../export-archive.ts';
import { entriesPath, entryRecordLine } from '../export-format.ts';
import { EntryExport } from './entry-export.ts';
import { type StreamingZip, streamingZip } from './streaming-zip.ts';

const writeArchive = (
  zip: StreamingZip,
  exports: EntryExport,
  context: ExportContext,
) => {
  let metadata = { ...context, entryCount: 0 };
  return exports.visit({
    onCount: (entryCount) => {
      metadata = { ...context, entryCount };
      return zip.addFile(manifestFile(metadata));
    },
    passes: [
      {
        before: zip.beginFile(entriesPath),
        onEntry: (entry) => zip.writeText(entryRecordLine(entry)),
        after: zip.endFile,
      },
      {
        before: Effect.suspend(() => zip.addFile(readmeFile(metadata))),
        onEntry: (entry) => zip.addFile(entryFile(entry)),
        after: Effect.void,
      },
    ],
  });
};

export const exportArchiveStream = (
  exports: EntryExport,
  context: ExportContext,
) => streamingZip((zip) => writeArchive(zip, exports, context));

export const journalExportStream = (context: ExportContext) =>
  streamingZip((zip) =>
    Effect.gen(function* () {
      const exports = yield* EntryExport;
      yield* writeArchive(zip, exports, context);
    }),
  );
