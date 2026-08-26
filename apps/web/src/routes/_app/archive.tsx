import { createFileRoute } from '@tanstack/react-router';

import { wideColumnClass } from '#/shared/ui/design-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * Placeholder until the archive page lands.
 *
 * This is the one page that widens: the year grid needs the wider measure, so
 * the archive takes it here rather than the shell handing every page the text
 * column.
 */
const ArchivePage = () => (
  <div className={wideColumnClass}>
    <section>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Archive</h1>
      <p className="mt-8 max-w-prose border-border border-t pt-8 text-ink-muted text-lg">
        Streaks, the activity heatmap, search, and exports will live here.
      </p>
    </section>
  </div>
);

export const Route = createFileRoute('/_app/archive')({
  component: ArchivePage,
  head: () => ({ meta: [{ title: pageTitle('Archive') }] }),
});
