import { describe, expect, it } from 'bun:test';

import {
  exportJournalResponseWith,
  invalidExportRequestMessage,
} from './export-response.ts';

const badRequestStatus = 400;
const okStatus = 200;

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
  readonly contentType: string | null;
}> => {
  let preparations = 0;
  const response = await exportJournalResponseWith(request, () => {
    preparations += 1;
    return Promise.resolve(new Response(null, { status: okStatus }));
  });

  return {
    preparations,
    status: response.status,
    body: await response.text(),
    cacheControl: response.headers.get('cache-control'),
    pragma: response.headers.get('pragma'),
    contentTypeOptions: response.headers.get('x-content-type-options'),
    contentType: response.headers.get('content-type'),
  };
};

const expectedBadRequest = {
  preparations: 0,
  status: badRequestStatus,
  body: invalidExportRequestMessage,
  cacheControl: 'private, no-store, max-age=0',
  pragma: 'no-cache',
  contentTypeOptions: 'nosniff',
  contentType: 'text/plain; charset=utf-8',
} as const;

describe('exportJournalResponseWith', () => {
  it('rejects malformed multipart data before preparing the export', async () => {
    const secret = 'private malformed boundary details';
    const result = await privateBadRequestResult(
      requestWith(secret, 'multipart/form-data; boundary=missing-boundary'),
    );

    expect(result).toEqual(expectedBadRequest);
    expect(result.body).not.toContain(secret);
  });

  it('rejects an unsupported grouping before preparing the export', async () => {
    const secret = 'private-quarter-name';
    const result = await privateBadRequestResult(
      requestWith(new URLSearchParams({ grouping: secret })),
    );

    expect(result).toEqual(expectedBadRequest);
    expect(result.body).not.toContain(secret);
  });

  it('rejects a file-valued grouping before preparing the export', async () => {
    const secret = 'private-file-contents';
    const formData = new FormData();
    formData.set('grouping', new File([secret], 'grouping.txt'));
    const result = await privateBadRequestResult(requestWith(formData));

    expect(result).toEqual(expectedBadRequest);
    expect(result.body).not.toContain(secret);
  });

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
