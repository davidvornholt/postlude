import { createFileRoute } from '@tanstack/react-router';

import { HeirloomDayLeaf } from '#/features/design-comparison/ui/heirloom/day-leaf.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

export const Route = createFileRoute('/heirloom/')({
  component: HeirloomDayLeaf,
  head: () => ({ meta: [{ title: pageTitle('Heirloom · Today') }] }),
});
