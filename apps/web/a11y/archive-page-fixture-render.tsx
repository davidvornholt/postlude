import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import {
  type ArchivePageFixtureConfig,
  neverDownloads,
} from './archive-page-fixture-contract.ts';
import { ArchivePage } from './archive-page-fixture-module.ts';

export const renderArchivePageFixture = (
  config: ArchivePageFixtureConfig,
): Promise<string> =>
  renderInRouter(
    <ArchivePage
      download={neverDownloads}
      selectedYear={config.selectedYear}
      view={config.view}
    />,
  );
