/**
 * One closed section of Insights: its name, the one thing it found, and the
 * detail behind that once the reader asks for it.
 *
 * The page opens on a sentence and a picture, and everything else waits here,
 * folded, so the first look is calm and the detail is one tap away rather than
 * one scroll past everything. The line beside the name is the answer the
 * section would give if it could say one thing, so a reader can skim the folds
 * without opening any.
 *
 * It is a native `details`, so it opens without JavaScript, announces its state
 * on its own, and keeps itself open while the reader steps to the next week or
 * month — the page is the same element with new numbers in it. The height
 * animation lives in the stylesheet with every other `details`.
 */

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';

export const InsightFold = ({
  title,
  takeaway,
  children,
}: {
  readonly title: string;
  readonly takeaway: string;
  readonly children: ReactNode;
}) => (
  <details className="group border-border border-t">
    <summary
      className={[
        'grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] [&::-webkit-details-marker]:hidden',
        focusRingClass,
      ].join(' ')}
    >
      <span className="text-ink">{title}</span>
      <span className="col-span-2 row-start-2 text-ink-muted text-sm sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {takeaway}
      </span>
      <ChevronDown
        aria-hidden="true"
        className="col-start-2 row-start-1 size-4 self-center text-ink-faint transition-transform duration-300 ease-standard group-open:rotate-180 motion-reduce:transition-none sm:col-start-3"
      />
    </summary>
    <div className="pt-2 pb-10">{children}</div>
  </details>
);
