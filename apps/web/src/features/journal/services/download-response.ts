export const exportUnavailableMessage =
  'The journal export could not be prepared. Return to the archive and try again.';

type ExportResponseOptions = {
  readonly body: ReadableStream<Uint8Array>;
  /** Resolved after preflight, once the snapshot has supplied its journal day. */
  readonly fileName: () => string;
  readonly signal: AbortSignal;
};

const privateHeaders = (): HeadersInit => ({
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  'x-content-type-options': 'nosniff',
});

const unavailableResponse = (): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Export unavailable</title></head><body><main><h1>Export unavailable</h1><p>${exportUnavailableMessage}</p><p><a href="/archive">Return to the archive</a></p></main></body></html>`,
    {
      status: 503,
      headers: {
        ...privateHeaders(),
        'content-type': 'text/html; charset=utf-8',
      },
    },
  );

/**
 * Preflights the first ZIP chunk before committing attachment headers. Once
 * they are sent, a later producer failure can only interrupt the browser's
 * download, so its stream error is replaced with the same safe public message.
 */
export const exportDownloadResponse = async ({
  body,
  fileName,
  signal,
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
      return unavailableResponse();
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

    return new Response(download, {
      headers: {
        ...privateHeaders(),
        'content-disposition': `attachment; filename="${preparedFileName}"`,
        'content-type': 'application/zip',
      },
    });
  } catch {
    finish();
    await reader.cancel().catch(() => undefined);
    return unavailableResponse();
  }
};
