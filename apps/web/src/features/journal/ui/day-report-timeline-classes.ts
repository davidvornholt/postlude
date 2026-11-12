/**
 * The timeline's marks as the drawing and its legend show them, so a swatch
 * in the legend is the very mark it names.
 */

import type { LegendKind } from '../day-report-timeline-layout.ts';

/** A mark's shape and color, by what the legend calls it. */
export const markShapeClass: Readonly<Record<LegendKind | 'part', string>> = {
  part: 'top-0 h-[18px] overflow-hidden bg-surface-sunken text-center text-[11px] text-ink-muted leading-[18px] tabular-nums',
  screen: 'top-[3px] h-3 bg-timeline-screen forced-colors:bg-[CanvasText]',
  focus: 'top-px h-4 border-2 border-ink',
  run: 'top-[5px] h-2 bg-timeline-run forced-colors:bg-[CanvasText]',
  appointment:
    'top-[3px] h-3 bg-timeline-appointment forced-colors:bg-[CanvasText]',
  prompt:
    'top-[5px] size-2 -translate-x-1/2 rounded-full bg-ink forced-colors:bg-[CanvasText]',
  phonePrompt:
    'top-[5px] size-2 -translate-x-1/2 rounded-full border-[1.5px] border-ink bg-background',
  pullRequest:
    'top-1 size-2.5 -translate-x-1/2 rotate-45 bg-timeline-pr forced-colors:bg-[CanvasText]',
  mail: 'top-[3px] h-2.5 w-3 -translate-x-1/2 bg-timeline-mail [clip-path:polygon(50%_0,100%_100%,0_100%)] forced-colors:bg-[CanvasText]',
};
