import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

import type { ExportGrouping } from '../src/features/journal/export-period.ts';
import type { ExportControlFixtureWindow } from './export-control-fixture-contract.ts';
import { ExportControl } from './export-control-fixture-module.ts';

const fixtureWindow = globalThis as unknown as ExportControlFixtureWindow;
const config = fixtureWindow.postludeExportControlFixture;
const queryClient = new QueryClient();

const download = async (grouping: ExportGrouping): Promise<Response> => {
  document.documentElement.dataset.requestedGrouping = grouping;
  await new Promise((resolve) => setTimeout(resolve, config.responseDelayMs));
  return new Response('postlude export fixture');
};

export const HydratedExportControl = () => {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ExportControl download={download} today={config.today} />
    </QueryClientProvider>
  );
};

const root = document.querySelector('#export-control-fixture');
if (root === null) {
  throw new Error('The export-control fixture root is missing.');
}

hydrateRoot(root, <HydratedExportControl />);
