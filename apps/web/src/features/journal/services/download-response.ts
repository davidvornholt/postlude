import {
  applyPrivateResponseHeaders,
  privateHtmlRecoveryResponse,
} from '#/shared/auth/private-response.ts';

export const exportUnavailableMessage =
  'Postlude could not prepare the download. Your journal is unchanged.';

type ExportResponseOptions = {
  readonly body: ReadableStream<Uint8Array>;
  /** Resolved after preflight, once the snapshot has supplied its journal day. */
  readonly fileName: () => string;
  readonly signal: AbortSignal;
  readonly styleSheetHref: string;
};

const unavailableResponse = (styleSheetHref: string): Response =>
  privateHtmlRecoveryResponse({
    actionHref: '/archive',
    actionLabel: 'Return to archive',
    heading: 'Export unavailable',
    message: exportUnavailableMessage,
    styleSheetHref,
    title: 'Export unavailable | Postlude',
  });

/**
 * Preflights the first ZIP chunk before committing attachment headers. Once
 * they are sent, a later producer failure can only interrupt the browser's
 * download, so its stream error is replaced with the same safe public message.
 */
export const exportDownloadResponse = async ({
  body,
  fileName,
  signal,
  styleSheetHref,
}: ExportResponseOptions): Promise<Response> => {
  const reader = body.getReader();
  let settled = false;
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    signal.removeEventListener('abort', cancel);
  };
  const cancel = () => {
    if (settled) {
      return;
    }
    finish();
    reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) {
    cancel();
  }

  try {
    const first = await reader.read();
    if (first.done || settled) {
      finish();
      await reader.cancel();
      return unavailableResponse(styleSheetHref);
    }
    const preparedFileName = fileName();

    const download = new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(first.value),
      pull: async (controller) => {
        try {
          const next = await reader.read();
          if (next.done) {
            finish();
            controller.close();
            return;
          }
          controller.enqueue(next.value);
        } catch {
          finish();
          controller.error(new Error(exportUnavailableMessage));
        }
      },
      cancel: async (reason) => {
        finish();
        await reader.cancel(reason).catch(() => undefined);
      },
    });

    const headers = new Headers({
      'content-disposition': `attachment; filename="${preparedFileName}"`,
      'content-type': 'application/zip',
    });
    applyPrivateResponseHeaders(headers);
    return new Response(download, { headers });
  } catch {
    finish();
    await reader.cancel().catch(() => undefined);
    return unavailableResponse(styleSheetHref);
  }
};
