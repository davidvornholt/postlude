import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';

import type { ExportGrouping } from '../src/features/journal/export-period.ts';
import type { ExportControlFixtureConfig } from './export-control-fixture-contract.ts';
import { ExportControl } from './export-control-fixture-module.ts';

const noDownload = (_grouping: ExportGrouping): Promise<Response> =>
  Promise.resolve(new Response());

export const renderExportControlFixture = (
  config: ExportControlFixtureConfig,
): string =>
  renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <ExportControl download={noDownload} today={config.today} />
    </QueryClientProvider>,
  );
