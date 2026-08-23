import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '#/shared/ui/page-title.ts';

/** Placeholder until the archive page lands with the chosen theme. */
const ArchivePage = () => (
  <section>
    <h1 className="font-display text-3xl text-ink tracking-tight">Archive</h1>
    <p className="mt-3 text-ink-muted">
      Streaks, the activity heatmap, search, and exports will live here.
    </p>
  </section>
);

export const Route = createFileRoute('/_app/archive')({
  component: ArchivePage,
  head: () => ({ meta: [{ title: pageTitle('Archive') }] }),
});
