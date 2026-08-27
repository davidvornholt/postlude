/** The authenticated native-download boundary for a journal archive. */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { env } from '#/shared/env.ts';
import { exportFileName } from '../export-archive.ts';
import { exportDownloadResponse } from './export-response.ts';
import { journalExportStream } from './export-stream.ts';
import { currentJournalDate } from './journal-fns.ts';
import { journalReadableStream } from './journal-runtime.ts';

/**
 * Prepares a private response only after the first ZIP bytes exist. The route
 * passes its abort signal through to the Effect stream so closing the request
 * releases the snapshot transaction and database connection.
 */
export const exportJournalResponse = async (
  signal: AbortSignal,
): Promise<Response> => {
  const clock = {
    exportedAt: new Date(),
    journalDate: currentJournalDate(),
    timeZone: env.JOURNAL_TIME_ZONE,
  };
  const body = await journalReadableStream(journalExportStream(clock));
  return exportDownloadResponse({
    body,
    fileName: exportFileName(clock.journalDate),
    signal,
  });
};

/** Kept until the concurrent archive UI batch replaces its RPC prop with the form. */
export const exportJournalFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .handler(() => exportJournalResponse(getRequest().signal));
