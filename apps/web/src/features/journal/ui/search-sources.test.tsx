import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { searchExcerpt, searchTerms } from '../search-query.ts';
import type { SearchHit, SearchResults } from '../services/search-fns.ts';
import { SearchPage } from './search-page.tsx';

const today = '2026-08-26';
const words = 120;
const sourceCount = 3;
const search = () => Promise.reject(new Error('SSR does not submit a search.'));

const renderHit = (query: string, hit: SearchHit) => {
  const results: SearchResults = {
    query,
    today,
    terms: searchTerms(query),
    hits: [hit],
    limited: false,
  };
  return renderInRouter(
    <SearchPage search={search} view={{ state: 'answered', results }} />,
  );
};

it('attributes every source needed to explain an all-term match', async () => {
  const html = await renderHit('rain mercy sprüche', {
    date: '2026-03-01',
    words,
    sources: [
      {
        kind: 'evening',
        excerpts: [searchExcerpt('Rain after dusk.', ['rain'])],
      },
      {
        kind: 'scripture-notes',
        excerpts: [searchExcerpt('Mercy in the morning.', ['mercy'])],
      },
      {
        kind: 'passage-reference',
        excerpts: [searchExcerpt('Sprüche 12:5', ['sprüche'])],
      },
    ],
  });
  const text = plainText(html);
  expect(text).toContain('EveningRain after dusk.');
  expect(text).toContain('Morning notesMercy in the morning.');
  expect(text).toContain('Passage referenceSprüche 12:5');
  expect(html.match(/<mark\b/gu)?.length).toBe(sourceCount);
});

it('offers sign-in recovery without exposing a private failure', async () => {
  const html = await renderInRouter(
    <SearchPage
      search={search}
      view={{ state: 'authentication-required', query: 'private rain' }}
    />,
  );
  expect(html).toContain('Your sign-in ended before the search finished');
  expect(
    attributeValue(elementAttributes(html, 'a', 'Sign in again'), 'href'),
  ).toBe('/login');
  expect(html).not.toContain('database');
});
