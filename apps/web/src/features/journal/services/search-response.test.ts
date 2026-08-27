import { describe, expect, it } from 'bun:test';

import type { SearchResults } from './search-fns.ts';
import { searchResponseOf } from './search-response.ts';

const results: SearchResults = {
  query: 'rain',
  today: '2026-08-27',
  terms: ['rain'],
  hits: [
    {
      date: '2026-03-01',
      words: 42,
      sources: [
        {
          kind: 'evening',
          excerpts: [[{ text: 'Rain', match: true, at: 0 }]],
        },
      ],
    },
  ],
  limited: false,
};

describe('search server-function response classification', () => {
  it('accepts a complete successful payload', () => {
    expect(searchResponseOf(results)).toEqual({ state: 'answered', results });
  });

  it('uses only a raw failure response status and never reads its body', () => {
    const unauthorized = new Response('private session detail', {
      status: 401,
    });
    const failed = new Response('private database detail', { status: 500 });

    expect(searchResponseOf(unauthorized)).toEqual({
      state: 'authentication-required',
    });
    expect(searchResponseOf(failed)).toEqual({ state: 'failed' });
    expect(unauthorized.bodyUsed).toBe(false);
    expect(failed.bodyUsed).toBe(false);
  });

  it('fails closed on malformed successful payloads', () => {
    expect(searchResponseOf({ ...results, hits: null })).toEqual({
      state: 'failed',
    });
    expect(
      searchResponseOf({
        ...results,
        hits: [{ ...results.hits[0], date: '2026-02-30' }],
      }),
    ).toEqual({ state: 'failed' });
    expect(
      searchResponseOf({
        ...results,
        hits: [
          {
            ...results.hits[0],
            sources: [{ kind: 'private-diagnostic', excerpts: [] }],
          },
        ],
      }),
    ).toEqual({ state: 'failed' });
  });
});
