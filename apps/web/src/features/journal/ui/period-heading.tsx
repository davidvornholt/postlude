/**
 * The name of a stretch of time, a month or a year, with the steps to the
 * ones either side of it.
 *
 * The arrows come before the name rather than around it. A name changes its
 * width with every step ("May 2026", "September 2026"), and an arrow placed
 * after it would move under the pointer of a reader stepping through the
 * months; placed before it, both stay put. A step that cannot be taken keeps
 * its place, dimmed, so nothing shifts into the gap it would leave.
 *
 * The line under the name holds the way back to the present. It keeps its
 * height when it is empty, so a step away from the present adds the link
 * without moving what is below.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type StepDirection = -1 | 1;

export const StepGlyph = ({
  direction,
}: {
  readonly direction: StepDirection;
}) => (direction < 0 ? <ChevronLeft /> : <ChevronRight />);

/**
 * An arrow with nowhere to go. It is the disabled-link pattern from the ARIA
 * practices: an anchor without a target, named and marked as unavailable, so a
 * screen reader finds the same two steps a sighted reader sees. It takes no
 * focus, because there is nothing to press.
 */
export const UnavailableStep = ({
  direction,
  label,
}: {
  readonly direction: StepDirection;
  readonly label: string;
}) => (
  // biome-ignore lint/a11y/useValidAnchor: The ARIA disabled-link pattern is an anchor without a target; a target would make it a step that can be taken.
  <a
    aria-disabled="true"
    aria-label={label}
    className="inline-flex size-11 items-center justify-center text-border-strong"
    role="link"
  >
    <StepGlyph direction={direction} />
  </a>
);

export const PeriodHeading = ({
  steps,
  line,
  children,
}: {
  /** The two steps, or nothing for a stretch that has no neighbours. */
  readonly steps: ReactNode;
  /** What sits under the name, such as the way back to the present. */
  readonly line: ReactNode;
  /** The name itself, which becomes the page's heading. */
  readonly children: ReactNode;
}) => {
  const stepped = steps !== undefined && steps !== null;
  return (
    // The arrows sit at the top, beside the name's first line, and the name's
    // padding centres that line on them; a name long enough to wrap grows
    // downwards and leaves the arrows where they were.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 sm:gap-x-4">
      {stepped ? <div className="-ml-3 flex sm:mt-0.5">{steps}</div> : null}
      <h1
        className={[
          'text-balance py-1 font-display text-3xl text-ink sm:py-0 sm:text-5xl',
          stepped ? '' : 'col-span-2',
        ].join(' ')}
      >
        {children}
      </h1>
      <p
        className={[
          'flex min-h-11 flex-wrap items-center gap-x-5 text-ink-faint text-sm',
          stepped ? 'col-start-2' : 'col-span-2',
        ].join(' ')}
      >
        {line}
      </p>
    </div>
  );
};
