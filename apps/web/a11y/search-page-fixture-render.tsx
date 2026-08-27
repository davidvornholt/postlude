import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import type { SearchPageFixtureConfig } from './search-page-fixture-contract.ts';
import { SearchPage } from './search-page-fixture-module.ts';
import { searchJournalFn } from './search-server-fixture-module.ts';

export const renderSearchPageFixture = (
  config: SearchPageFixtureConfig,
): Promise<string> =>
  renderInRouter(<SearchPage search={searchJournalFn} view={config.view} />);
