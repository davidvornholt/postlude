import { describe, expect, it } from 'bun:test';

import { applyPrivateResponseHeaders } from '#/shared/auth/private-response.ts';
import { runSessionRequired } from '#/shared/auth/session-required.ts';
import {
  exportJournalResponseWith,
  invalidExportRequestMessage,
} from './export-response.ts';

const badRequestStatus = 400;
const okStatus = 200;

const responseFrom = async (promise: Promise<unknown>): Promise<Response> => {
  const result = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(result instanceof Response)) {
    throw new Error('The authenticated export did not return a response.');
  }
  return result;
};

const requestWith = (body: BodyInit, contentType?: string): Request =>
  new Request('https://postlude.test/archive/export', {
    method: 'POST',
    body,
    ...(contentType === undefined
      ? {}
      : { headers: { 'content-type': contentType } }),
  });

const privateBadRequestResult = async (
  request: Request,
): Promise<{
  readonly preparations: number;
  readonly status: number;
  readonly body: string;
  readonly cacheControl: string | null;
  readonly pragma: string | null;
  readonly contentTypeOptions: string | null;
}> => {
  let preparations = 0;
  const publishedHeaders = new Headers();
  const response = await responseFrom(
    runSessionRequired({
      request,
      authorize: () => Promise.resolve(true),
      next: () =>
        exportJournalResponseWith(request, () => {
          preparations += 1;
          return Promise.resolve(new Response(null, { status: okStatus }));
        }),
      publishHeaders: () => applyPrivateResponseHeaders(publishedHeaders),
    }),
  );

  return {
    preparations,
    status: response.status,
    body: await response.text(),
    cacheControl: response.headers.get('cache-control'),
    pragma: response.headers.get('pragma'),
    contentTypeOptions: response.headers.get('x-content-type-options'),
  };
};

const expectedBadRequest = {
  preparations: 0,
  status: badRequestStatus,
  body: invalidExportRequestMessage,
  cacheControl: 'private, no-store, max-age=0',
  pragma: 'no-cache',
  contentTypeOptions: 'nosniff',
} as const;

describe('authenticated export route boundary', () => {
  it('returns a private 400 for malformed multipart data before preparing the export', async () => {
    const secret = 'private malformed boundary details';
    const result = await privateBadRequestResult(
      requestWith(secret, 'multipart/form-data; boundary=missing-boundary'),
    );

    expect(result).toEqual(expectedBadRequest);
    expect(result.body).not.toContain(secret);
  });

  it('returns a private 400 for an unsupported grouping before preparing the export', async () => {
    const secret = 'private-quarter-name';
    const result = await privateBadRequestResult(
      requestWith(new URLSearchParams({ grouping: secret })),
    );

    expect(result).toEqual(expectedBadRequest);
    expect(result.body).not.toContain(secret);
  });

  it('returns a private 400 for a file-valued grouping before preparing the export', async () => {
    const secret = 'private-file-contents';
    const formData = new FormData();
    formData.set('grouping', new File([secret], 'grouping.txt'));
    const result = await privateBadRequestResult(requestWith(formData));

    expect(result).toEqual(expectedBadRequest);
    expect(result.body).not.toContain(secret);
  });
});

describe('exportJournalResponseWith', () => {
  it('keeps omitted grouping compatible with the original daily export', async () => {
    let observedGrouping: string | undefined;
    const response = await exportJournalResponseWith(
      requestWith(new URLSearchParams()),
      (_request, grouping) => {
        observedGrouping = grouping;
        return Promise.resolve(new Response(null, { status: okStatus }));
      },
    );

    expect(response.status).toBe(okStatus);
    expect(observedGrouping).toBe('day');
  });
});
