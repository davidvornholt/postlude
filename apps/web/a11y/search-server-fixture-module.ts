import {
  searchExcerpt,
  searchTerms,
} from '../src/features/journal/search-query.ts';
import type {
  SearchHit,
  SearchResults,
} from '../src/features/journal/services/search-fns.ts';
import type { SearchPageView } from '../src/features/journal/ui/search-page.tsx';
import type {
  SearchFixtureOutcome,
  SearchPageFixtureWindow,
} from './search-page-fixture-contract.ts';

const today = '2026-08-26';
const fixtureDelayMs = 120;
const words = 42;
const longTokenRepeat = 45;
const longToken = `rain${'water'.repeat(longTokenRepeat)}`;

const hit = (query: string): SearchHit => ({
  date: '2026-03-01',
  words,
  sources: [
    {
      kind: 'evening',
      excerpts: [
        searchExcerpt(
          `The private ${longToken} returned after dusk.`,
          searchTerms(query),
        ),
      ],
    },
  ],
});

const multiSourceHit = (): SearchHit => ({
  date: '2026-03-01',
  words,
  sources: [
    {
      kind: 'evening',
      excerpts: [searchExcerpt('Rain returned after dusk.', ['rain'])],
    },
    {
      kind: 'scripture-notes',
      excerpts: [searchExcerpt('Mercy met the morning.', ['mercy'])],
    },
    {
      kind: 'passage-reference',
      excerpts: [searchExcerpt('Sprüche 12:5', ['sprüche'])],
    },
  ],
});

export const searchFixtureAnswer = (
  query: string,
  limited: boolean,
  multiSource = false,
): SearchResults => ({
  query,
  today,
  terms: searchTerms(query),
  hits: [multiSource ? multiSourceHit() : hit(query)],
  limited,
});

export const searchFixtureView = (
  outcome: Exclude<SearchFixtureOutcome, 'loading'>,
  query: string,
): SearchPageView => {
  if (outcome === 'authentication') {
    return { state: 'authentication-required', query };
  }
  if (outcome === 'error') {
    return { state: 'failed', query };
  }
  if (outcome === 'empty') {
    return {
      state: 'answered',
      results: {
        query,
        today,
        terms: searchTerms(query),
        hits: [],
        limited: false,
      },
    };
  }
  return {
    state: 'answered',
    results: searchFixtureAnswer(query, outcome === 'limited'),
  };
};

export const searchJournalFn = async ({
  data,
}: {
  readonly data: { readonly q?: string };
}): Promise<SearchResults> => {
  const config = (globalThis as unknown as SearchPageFixtureWindow)
    .postludeSearchPageFixture;
  const query = data.q ?? '';
  if (config.outcome === 'loading') {
    return new Promise(() => undefined);
  }
  await new Promise((resolve) => setTimeout(resolve, fixtureDelayMs));
  if (config.outcome === 'error') {
    throw new Error('private fixture detail');
  }
  if (config.outcome === 'authentication') {
    throw new Response('Not authorized.', { status: 401 });
  }
  const view = searchFixtureView(config.outcome, query);
  if (view.state !== 'answered') {
    throw new Error('A failed fixture must reject before producing a view.');
  }
  return config.outcome === 'multi-source'
    ? searchFixtureAnswer(query, false, true)
    : view.results;
};
