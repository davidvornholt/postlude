import { createFileRoute } from '@tanstack/react-router';

import { columnClass } from '#/shared/ui/design-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

/**
 * Placeholder until the writing page lands.
 *
 * The page sets its own measure, not the shell: this is what the deep register
 * will step outside of when the morning scripture section arrives.
 */
const TodayPage = () => (
  <div className={columnClass}>
    <section>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Today</h1>
      <p className="mt-8 max-w-prose border-border border-t pt-8 text-ink-muted text-lg">
        The writing page lands next: the morning scripture section, the evening
        journal, and an editor that saves as you type.
      </p>
    </section>
  </div>
);

export const Route = createFileRoute('/_app/')({
  component: TodayPage,
  head: () => ({ meta: [{ title: pageTitle('Today') }] }),
});
