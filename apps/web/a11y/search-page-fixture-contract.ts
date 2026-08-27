import type { SearchPageView } from '../src/features/journal/ui/search-page.tsx';

export type SearchFixtureOutcome =
  | 'authentication'
  | 'empty'
  | 'error'
  | 'limited'
  | 'loading'
  | 'multi-source'
  | 'populated'
  | 'unicode';

export type SearchPageFixtureConfig = {
  readonly outcome: SearchFixtureOutcome;
  readonly view: SearchPageView;
};

export type SearchPageFixtureWindow = Window & {
  postludeSearchPageFixture: SearchPageFixtureConfig;
};
