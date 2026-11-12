/**
 * The day report's timeline block: its heading, with the control that widens
 * the timeline beside it, the drawing (`day-report-timeline-drawing.tsx`), its
 * legend, and the notes on what it may be missing.
 *
 * The timeline opens at the column's width every time. On a screen wide
 * enough, the control widens it out to the window's edges, less the page's
 * margin, and narrows it again (`use-timeline-width.ts`); it stays wide until
 * the page is left. The heading, the legend's words and the notes stay in the
 * column whichever it is.
 */

import { FoldHorizontal, UnfoldHorizontal } from 'lucide-react';
import { useId, useMemo } from 'react';

import { readingMeasureClass } from '#/shared/ui/design-classes.ts';
import {
  axisOf,
  type LegendKind,
  legendOf,
} from '../day-report-timeline-layout.ts';
import type { TimelineBlock } from '../schemas/day-report-timeline.ts';
import type { BlockProps } from './day-report-blocks.tsx';
import { ReportHeading } from './day-report-text.tsx';
import { markShapeClass } from './day-report-timeline-classes.ts';
import { TimelineDrawing } from './day-report-timeline-drawing.tsx';
import { JournalIconButton } from './journal-icon-button.tsx';
import { useTimelineWidth } from './use-timeline-width.ts';

/** Whether the timeline is wide, which the whole report shares, and how to change it. */
export type TimelineWidthProps = {
  readonly wide: boolean;
  readonly onWideChange: (wide: boolean) => void;
};

const pointKinds: ReadonlySet<LegendKind> = new Set([
  'prompt',
  'phonePrompt',
  'pullRequest',
  'mail',
]);

const Swatch = ({ kind }: { readonly kind: LegendKind }) => (
  <span className="relative inline-block h-[18px] w-4 shrink-0">
    <span
      className={`absolute ${pointKinds.has(kind) ? 'left-1/2' : 'inset-x-0'} ${markShapeClass[kind]}`}
    />
  </span>
);

export const TimelineView = ({
  block,
  depth,
  wide,
  onWideChange,
}: BlockProps<TimelineBlock> & TimelineWidthProps) => {
  const axis = useMemo(() => axisOf(block), [block]);
  const legend = useMemo(() => legendOf(block), [block]);
  const headingId = useId();
  const width = useTimelineWidth(wide);

  return (
    <section aria-labelledby={headingId}>
      <div className="flex min-h-11 items-center gap-2">
        <ReportHeading depth={depth} id={headingId}>
          {block.heading}
        </ReportHeading>
        {axis === undefined ? null : (
          <span className="hidden lg:inline-flex">
            <JournalIconButton
              aria-pressed={wide}
              hintAlign="start"
              icon={wide ? FoldHorizontal : UnfoldHorizontal}
              label="Widen the timeline"
              onClick={() => onWideChange(!wide)}
            />
          </span>
        )}
      </div>
      {axis === undefined ? (
        <p className="mt-2 text-ink-muted">Nothing recorded.</p>
      ) : (
        <div className="mt-2" ref={width.slotRef}>
          <div className={width.figureClass} ref={width.figureRef}>
            <TimelineDrawing
              axis={axis}
              block={block}
              label={`${block.heading}: a drawing of the day by the hour`}
            />
            <ul
              aria-hidden={true}
              className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted text-xs"
            >
              {legend.map(([kind, text]) => (
                <li className="inline-flex items-center gap-1.5" key={kind}>
                  <Swatch kind={kind} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {block.notes === undefined || block.notes.length === 0 ? null : (
        <div
          className={`${readingMeasureClass} mt-3 grid gap-1 text-ink-muted text-sm`}
        >
          {block.notes.map((note, noteIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: notes may repeat, and stored notes never move.
            <p key={noteIndex}>{note}</p>
          ))}
        </div>
      )}
    </section>
  );
};
