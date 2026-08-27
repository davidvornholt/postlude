import { beforeEach, expect, it } from 'bun:test';

import type { SearchResults } from '#/features/journal/services/search-fns.ts';
import { applyPrivateResponseHeaders } from '#/shared/auth/private-response.ts';
import { runSessionRequired } from '#/shared/auth/session-required.ts';

const today = '2026-08-26';
const overLimitLength = 201;
const seeOther = 303;
const unauthorized = 401;
const internalServerError = 500;
let searches: ReadonlyArray<unknown> = [];
let rejects = false;
let responseStatus: number | undefined;

const answered = (query: string): SearchResults => ({
  query,
  today,
  terms: query === '' ? [] : [query],
  hits: [],
  limited: false,
});

const privateHeadersOf = (headers: Headers) => ({
  cacheControl: headers.get('cache-control'),
  pragma: headers.get('pragma'),
  contentTypeOptions: headers.get('x-content-type-options'),
});

const expectedPrivateHeaders = {
  cacheControl: 'private, no-store, max-age=0',
  pragma: 'no-cache',
  contentTypeOptions: 'nosniff',
};

const search = (input: unknown): Promise<unknown> => {
  searches = [...searches, input];
  if (rejects) {
    return Promise.reject(new Error('private database detail'));
  }
  if (responseStatus !== undefined) {
    return Promise.resolve(
      new Response('private transport detail', { status: responseStatus }),
    );
  }
  const q = (input as { data?: { q?: string } }).data?.q ?? '';
  return Promise.resolve(answered(q));
};

beforeEach(() => {
  searches = [];
  rejects = false;
  responseStatus = undefined;
});

const { handleSearchPost, loadSearchView } = await import(
  './-search-request.ts'
);

const submit = (query: string) =>
  handleSearchPost(
    {
      request: new Request('https://postlude.test/search', {
        body: new URLSearchParams({ q: query }),
        method: 'POST',
      }),
      next: (options) => ({
        isNext: true as const,
        context: options?.context,
      }),
    },
    search,
  );

it('passes a native POST search to the normal page loader without a URL query', async () => {
  const response = await submit('private rain');
  expect(response).toMatchObject({
    isNext: true,
    context: {
      searchView: {
        state: 'answered',
        results: { query: 'private rain' },
      },
    },
  });
  expect(searches).toEqual([{ data: { q: 'private rain' } }]);
  if (
    response === undefined ||
    response instanceof Response ||
    response.isNext !== true
  ) {
    throw new Error('The POST did not defer to the styled search route.');
  }

  expect(await loadSearchView(response.context, search)).toMatchObject({
    state: 'answered',
    results: { query: 'private rain' },
  });
});

it('renders an overlong native query as a field error without sending it', async () => {
  const query = 'x'.repeat(overLimitLength);
  await expect(submit(query)).resolves.toMatchObject({
    context: { searchView: { state: 'invalid', query } },
  });
  expect(searches).toEqual([]);
});

it('turns a private server failure into a retryable page state', async () => {
  rejects = true;
  await expect(submit('rain')).resolves.toMatchObject({
    context: { searchView: { state: 'failed', query: 'rain' } },
  });
});

it('classifies resolved raw server-function failures without reading a body', async () => {
  responseStatus = unauthorized;
  await expect(submit('rain')).resolves.toMatchObject({
    context: {
      searchView: { state: 'authentication-required', query: 'rain' },
    },
  });
  responseStatus = internalServerError;
  await expect(submit('rain')).resolves.toMatchObject({
    context: { searchView: { state: 'failed', query: 'rain' } },
  });
});

it('redirects an expired native POST before the route can search', async () => {
  const responseHeaders = new Headers();
  const request = new Request('https://postlude.test/search', {
    body: new URLSearchParams({ q: 'private rain' }),
    method: 'POST',
  });
  const failure = await runSessionRequired({
    request,
    authorize: () => Promise.resolve(false),
    next: () =>
      handleSearchPost(
        {
          request,
          next: (options) => options,
        },
        search,
      ),
    publishHeaders: () => applyPrivateResponseHeaders(responseHeaders),
  }).then(
    () => undefined,
    (error: unknown) => error,
  );

  expect(failure).toBeInstanceOf(Response);
  if (!(failure instanceof Response)) {
    throw new Error('The expired document session did not return a response.');
  }
  expect(failure.status).toBe(seeOther);
  expect(failure.headers.get('location')).toBe('/login');
  expect(privateHeadersOf(failure.headers)).toEqual(expectedPrivateHeaders);
  expect(await failure.text()).toBe('');
  expect(searches).toEqual([]);
  expect(privateHeadersOf(responseHeaders)).toEqual(expectedPrivateHeaders);
});

it('keeps an expired server-function call on a private raw 401', async () => {
  const failure = await runSessionRequired({
    request: new Request('https://postlude.test/server-function', {
      headers: { 'x-tsr-serverFn': 'true' },
      method: 'POST',
    }),
    authorize: () => Promise.resolve(false),
    next: () => Promise.reject(new Error('unreachable private search')),
    publishHeaders: () => undefined,
  }).then(
    () => undefined,
    (error: unknown) => error,
  );

  expect(failure).toBeInstanceOf(Response);
  if (!(failure instanceof Response)) {
    throw new Error('The expired server function did not return a response.');
  }
  expect(failure.status).toBe(unauthorized);
  expect(privateHeadersOf(failure.headers)).toEqual(expectedPrivateHeaders);
  expect(await failure.text()).toBe('Not authorized.');
});
