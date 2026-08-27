import { beforeEach, expect, it } from 'bun:test';

import type { SearchResults } from '#/features/journal/services/search-fns.ts';

const today = '2026-08-26';
const overLimitLength = 201;
let searches: ReadonlyArray<unknown> = [];
let rejects = false;
let unauthorized = false;

const answered = (query: string): SearchResults => ({
  query,
  today,
  terms: query === '' ? [] : [query],
  hits: [],
  limited: false,
});

const search = (input: unknown): Promise<SearchResults> => {
  searches = [...searches, input];
  if (rejects) {
    return Promise.reject(new Error('private database detail'));
  }
  if (unauthorized) {
    return Promise.reject(new Response('Not authorized.', { status: 401 }));
  }
  const q = (input as { data?: { q?: string } }).data?.q ?? '';
  return Promise.resolve(answered(q));
};

beforeEach(() => {
  searches = [];
  rejects = false;
  unauthorized = false;
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

it('turns an expired native session into a sign-in recovery state', async () => {
  unauthorized = true;
  await expect(submit('rain')).resolves.toMatchObject({
    context: {
      searchView: { state: 'authentication-required', query: 'rain' },
    },
  });
});
