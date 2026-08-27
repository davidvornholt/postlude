/** Prepares the journal archive response for the authenticated route POST. */

import type { ApplicationStyleSheetHrefs } from '#/shared/ui/application-style-sheets.ts';
import { JournalValidationError } from '../errors/journal-errors.ts';
import { exportFileName } from '../export-archive.ts';
import type { ExportGrouping } from '../export-period.ts';
import { decodeExportFormData } from '../schemas/export-input.ts';
import { exportDownloadResponse } from './download-response.ts';

export const invalidExportRequestMessage =
  'The export request was not valid. Return to the archive and try again.';

type PrepareExportResponse = (
  request: Request,
  grouping: ExportGrouping,
) => Promise<Response>;

/** Validates native form data before acquiring the journal runtime. */
export const exportJournalResponseWith = async (
  request: Request,
  prepare: PrepareExportResponse,
): Promise<Response> => {
  let grouping: ExportGrouping;
  try {
    ({ grouping } = decodeExportFormData(await request.formData()));
  } catch (cause) {
    // biome-ignore lint/style/useErrorCause: Effect tagged errors carry causes in their typed payload.
    throw new JournalValidationError({
      message: invalidExportRequestMessage,
      cause,
    });
  }
  return prepare(request, grouping);
};

const prepareExportJournalResponse = async (
  request: Request,
  grouping: ExportGrouping,
  styleSheetHrefs: ApplicationStyleSheetHrefs,
): Promise<Response> => {
  const [{ env }, { journalExportStream }, { journalReadableStream }] =
    await Promise.all([
      import('#/shared/env.ts'),
      import('./export-stream.ts'),
      import('./journal-runtime.ts'),
    ]);
  let journalDate: string | undefined;
  const body = await journalReadableStream(
    journalExportStream(
      env.JOURNAL_TIME_ZONE,
      (context) => {
        ({ journalDate } = context);
      },
      grouping,
    ),
  );
  return exportDownloadResponse({
    body,
    fileName: () => {
      if (journalDate === undefined) {
        throw new TypeError('The export journal day was not prepared.');
      }
      return exportFileName(journalDate, grouping);
    },
    signal: request.signal,
    styleSheetHrefs,
  });
};

export const exportJournalResponse = (
  request: Request,
  styleSheetHrefs: ApplicationStyleSheetHrefs,
): Promise<Response> =>
  exportJournalResponseWith(request, (validatedRequest, grouping) =>
    prepareExportJournalResponse(validatedRequest, grouping, styleSheetHrefs),
  );
