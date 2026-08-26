import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '#/shared/ui/page-title.ts';

/** Placeholder until the archive page lands. */
const ArchivePage = () => (
  <section>
    <h1 className="font-display text-4xl text-ink sm:text-5xl">Archive</h1>
    <p className="mt-8 max-w-prose border-border border-t pt-8 text-ink-muted text-lg">
      Streaks, the activity heatmap, search, and exports will live here.
    </p>
  </section>
);

export const Route = createFileRoute('/_app/archive')({
  component: ArchivePage,
  head: () => ({ meta: [{ title: pageTitle('Archive') }] }),
});
