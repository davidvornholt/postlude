import { expect, it } from 'bun:test';

import { runSessionRequired } from '#/shared/auth/session-required.ts';

import {
  exportDownloadResponse,
  exportUnavailableMessage,
} from './download-response.ts';

const okStatus = 200;
const unavailableStatus = 503;
const styleSheetHrefs = [
  '/assets/inter.css',
  '/assets/fraunces.css',
  '/assets/postlude.css',
] as const;

const bodyOf = (...chunks: ReadonlyArray<string>) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
};

it('keeps every streamed chunk and sets private native-download headers', async () => {
  const response = await exportDownloadResponse({
    body: bodyOf('first', 'second'),
    fileName: () => 'postlude-2026-08-26.zip',
    signal: new AbortController().signal,
    styleSheetHrefs,
  });

  expect(response.status).toBe(okStatus);
  expect(await response.text()).toBe('firstsecond');
  expect(response.headers.get('content-type')).toBe('application/zip');
  expect(response.headers.get('content-disposition')).toBe(
    'attachment; filename="postlude-2026-08-26.zip"',
  );
  expect(response.headers.get('cache-control')).toBe(
    'private, no-store, max-age=0',
  );
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.has('content-length')).toBeFalse();
});

it('turns a failure before the first chunk into a safe retryable response', async () => {
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.error(new Error('postgres://secret')),
  });

  const response = await exportDownloadResponse({
    body,
    fileName: () => 'postlude.zip',
    signal: new AbortController().signal,
    styleSheetHrefs,
  });

  expect(response.status).toBe(unavailableStatus);
  const document = await response.text();
  expect(document).toContain(exportUnavailableMessage);
  expect(document).toContain('href="/archive"');
  expect(document).toContain('<title>Export unavailable | Postlude</title>');
  expect(document).toContain('<main class=');
  expect(document).toContain('id="recovery-heading">Export unavailable</h1>');
  for (const href of styleSheetHrefs) {
    expect(document).toContain(`href="${href}"`);
  }
  expect(document).not.toContain('<style>');
  expect(document).toContain('autofocus');
  expect(document).not.toContain('postgres://secret');
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.has('content-disposition')).toBeFalse();
  expect(response.headers.get('cache-control')).toContain('no-store');
});

it('keeps the actual export recovery response through session authentication', async () => {
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.error(new Error('private journal cause')),
  });
  const recovery = await exportDownloadResponse({
    body,
    fileName: () => 'postlude.zip',
    signal: new AbortController().signal,
    styleSheetHrefs,
  });

  const result = await runSessionRequired({
    request: new Request('https://postlude.test/archive/export', {
      method: 'POST',
    }),
    authorize: () => Promise.resolve(true),
    next: () => Promise.resolve(recovery),
    publishHeaders: () => undefined,
  });

  expect(result).toBe(recovery);
  expect(result.status).toBe(unavailableStatus);
  expect(await result.text()).not.toContain('private journal cause');
  expect(result.headers.get('cache-control')).toBe(
    'private, no-store, max-age=0',
  );
  expect(result.headers.get('pragma')).toBe('no-cache');
  expect(result.headers.get('x-content-type-options')).toBe('nosniff');
});

it('sanitizes a stream failure after attachment headers are committed', async () => {
  const encoder = new TextEncoder();
  let pull = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pull += 1;
        if (pull === 1) {
          controller.enqueue(encoder.encode('first'));
          return;
        }
        controller.error(new Error('select * from entry password=secret'));
      },
    },
    { highWaterMark: 0 },
  );
  const response = await exportDownloadResponse({
    body,
    fileName: () => 'postlude.zip',
    signal: new AbortController().signal,
    styleSheetHrefs,
  });

  await expect(response.text()).rejects.toThrow(exportUnavailableMessage);
});

it('cancels the producer when its request is aborted', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.enqueue(new Uint8Array([1])),
    cancel: () => {
      cancelled = true;
    },
  });
  const request = new AbortController();
  const response = await exportDownloadResponse({
    body,
    fileName: () => 'postlude.zip',
    signal: request.signal,
    styleSheetHrefs,
  });

  request.abort();
  await Promise.resolve();

  expect(response.status).toBe(okStatus);
  expect(cancelled).toBeTrue();
});

it('cancels a producer when the request closes during first-chunk preflight', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel: () => {
      cancelled = true;
    },
  });
  const request = new AbortController();
  const pending = exportDownloadResponse({
    body,
    fileName: () => 'postlude.zip',
    signal: request.signal,
    styleSheetHrefs,
  });

  request.abort();
  const response = await pending;

  expect(response.status).toBe(unavailableStatus);
  expect(cancelled).toBeTrue();
  expect(response.headers.has('content-disposition')).toBeFalse();
});
