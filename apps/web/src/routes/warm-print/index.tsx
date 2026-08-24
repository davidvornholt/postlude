import { createFileRoute } from '@tanstack/react-router';

import { WarmPrintDay } from '#/features/design-comparison/ui/warm-print/day-page.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

export const Route = createFileRoute('/warm-print/')({
  component: WarmPrintDay,
  head: () => ({ meta: [{ title: pageTitle('Warm print · Today') }] }),
});
