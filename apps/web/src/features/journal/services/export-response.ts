/** Prepares the journal archive response for the authenticated route POST. */

import { env } from '#/shared/env.ts';
import type { ApplicationStyleSheetHrefs } from '#/shared/ui/application-style-sheets.ts';
import { exportFileName } from '../export-archive.ts';
import { exportDownloadResponse } from './download-response.ts';
import { journalExportStream } from './export-stream.ts';
import { journalReadableStream } from './journal-runtime.ts';

/**
 * Prepares a private response only after the first ZIP bytes exist. The route
 * passes its abort signal through to the Effect stream so closing the request
 * releases the snapshot transaction and database connection.
 */
export const exportJournalResponse = async (
  signal: AbortSignal,
  styleSheetHrefs: ApplicationStyleSheetHrefs,
): Promise<Response> => {
  let journalDate: string | undefined;
  const body = await journalReadableStream(
    journalExportStream(env.JOURNAL_TIME_ZONE, (context) => {
      ({ journalDate } = context);
    }),
  );
  return exportDownloadResponse({
    body,
    fileName: () => {
      if (journalDate === undefined) {
        throw new TypeError('The export journal day was not prepared.');
      }
      return exportFileName(journalDate);
    },
    signal,
    styleSheetHrefs,
  });
};
