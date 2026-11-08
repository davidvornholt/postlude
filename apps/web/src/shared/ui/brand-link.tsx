/**
 * The wordmark that links home. It is a way back, not a position in the nav,
 * so it goes through `UnmarkedLink` and never announces itself as the current
 * page.
 *
 * The name closes on a final barline, the thin and the thick stroke that end a
 * piece of music: a postlude is the music played at the end, and this is where
 * the day is closed. The strokes stand on the baseline and reach the capitals,
 * so they scale with the name, and they are drawn in the green the current
 * place is underlined with. They say nothing a reader needs, so assistive
 * technology hears only the name.
 */

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { UnmarkedLink } from '#/shared/ui/unmarked-link.tsx';

export const BrandLink = () => (
  <UnmarkedLink
    activeProps={{ className: '' }}
    className={`inline-flex items-baseline ${focusRingClass}`}
    to="/"
  >
    Postlude
    <span
      aria-hidden="true"
      className="ml-[0.22em] inline-flex h-[0.73em] gap-[0.1em]"
    >
      <span className="w-px bg-primary" />
      <span className="w-[0.16em] bg-primary" />
    </span>
  </UnmarkedLink>
);
