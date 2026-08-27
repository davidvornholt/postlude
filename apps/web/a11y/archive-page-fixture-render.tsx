import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import type { ArchivePageFixtureConfig } from './archive-page-fixture-contract.ts';
import { ArchivePage } from './archive-page-fixture-module.ts';

export const renderArchivePageFixture = (
  config: ArchivePageFixtureConfig,
): Promise<string> =>
  renderInRouter(
    <ArchivePage
      selectedYear={config.selectedYear}
      settleAutosaves={() => Promise.resolve()}
      view={config.view}
    />,
  );
