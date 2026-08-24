import { createFileRoute } from '@tanstack/react-router';

import { HeirloomArchive } from '#/features/design-comparison/ui/heirloom/archive-view.tsx';
import { pageTitle } from '#/shared/ui/page-title.ts';

export const Route = createFileRoute('/heirloom/archive')({
  component: HeirloomArchive,
  head: () => ({ meta: [{ title: pageTitle('Heirloom · Archive') }] }),
});
