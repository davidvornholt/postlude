import type { SearchPageView } from '../src/features/journal/ui/search-page.tsx';

export type SearchFixtureOutcome =
  | 'empty'
  | 'error'
  | 'limited'
  | 'loading'
  | 'populated';

export type SearchPageFixtureConfig = {
  readonly outcome: SearchFixtureOutcome;
  readonly view: SearchPageView;
};

export type SearchPageFixtureWindow = Window & {
  postludeSearchPageFixture: SearchPageFixtureConfig;
};
