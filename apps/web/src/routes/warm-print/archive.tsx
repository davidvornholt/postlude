import { createFileRoute } from '@tanstack/react-router';

import { WarmPrintArchive } from '#/features/design-comparison/ui/warm-print/archive-view.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

export const Route = createFileRoute('/warm-print/archive')({
  component: WarmPrintArchive,
  head: () => ({ meta: [{ title: pageTitle('Warm print · Archive') }] }),
});
