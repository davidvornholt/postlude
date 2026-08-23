import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '#/shared/ui/page-title.ts';

/** Placeholder until the writing page lands with the chosen theme. */
const TodayPage = () => (
  <section>
    <h1 className="font-display text-3xl text-ink tracking-tight">Today</h1>
    <p className="mt-3 text-ink-muted">
      The writing page arrives with the design comparison: scripture section,
      evening journal, and an editor that saves as you type.
    </p>
  </section>
);

export const Route = createFileRoute('/_app/')({
  component: TodayPage,
  head: () => ({ meta: [{ title: pageTitle('Today') }] }),
});
