/**
 * The export's server function: the whole journal, zipped, as one response.
 *
 * It returns a `Response` rather than data. TanStack Start hands a `Response` a
 * server function returns straight back to the caller instead of serialising it,
 * which is what lets the zip travel as bytes with the name it should be saved
 * under, without a route of its own outside the session guard every other read
 * here carries.
 *
 * The zip is built in memory. A journal is prose: a decade of daily entries is a
 * few megabytes before compression and rather less after it, and streaming the
 * archive out entry by entry would buy nothing but a second code path for the
 * failure the whole-read already reports.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { zipSync } from 'fflate';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { runServerEffect } from '#/shared/runtime/app-runtime.ts';
import {
  type ExportFile,
  exportFileName,
  exportFiles,
} from '../export-archive.ts';
import { EntryExport } from './entry-export.ts';
import { currentJournalDate } from './journal-fns.ts';

const encoder = new TextEncoder();

/*
 * `zipSync` wants a tree of names to bytes, and a `/` in a name is a folder to
 * it, which is what puts each year in one. The default deflate level is the
 * library's own; prose compresses well enough at it that trading time for the
 * last few percent would be paying for nothing.
 */
const zipOf = (files: ReadonlyArray<ExportFile>): Uint8Array =>
  zipSync(
    Object.fromEntries(
      files.map((entry) => [entry.path, encoder.encode(entry.text)] as const),
    ),
  );

/**
 * The bytes as a download rather than as something to render. `Content-Length`
 * is set because the size is already known, so the browser can show real
 * progress instead of a spinner that says nothing.
 */
const download = (zip: Uint8Array, name: string): Response =>
  new Response(zip as unknown as BodyInit, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}"`,
      'content-length': String(zip.byteLength),
    },
  });

export const exportJournalFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .handler(
    (): Promise<Response> =>
      runServerEffect(
        Effect.gen(function* () {
          const today = currentJournalDate();
          const entries = yield* (yield* EntryExport).readAll();
          return download(
            zipOf(exportFiles(entries, today)),
            exportFileName(today),
          );
        }),
      ),
  );
