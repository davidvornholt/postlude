/**
 * Where a timeline block's marks sit and what each one says, worked out from
 * the block alone, so the server and the browser draw the same timeline.
 *
 * The axis runs in whole hours of the day's own clock, from the hour of the
 * first mark to the hour after the last. A mark's place is a share of it, so
 * the drawing scales with its width. Its labels thin out to every second,
 * third or fourth hour, and further, as the drawing narrows, so they never
 * run into each other.
 */

import { clockAt, offsetMinutesOf } from './day-report-format.ts';
import type {
  TimelineBlock,
  TimelineMark,
} from './schemas/day-report-timeline.ts';

const millisecondsPerMinute = 60_000;
const minutesPerHour = 60;
const hourMs = minutesPerHour * millisecondsPerMinute;
const percent = 100;

export type TimelineAxis = {
  readonly start: number;
  readonly end: number;
  readonly hours: number;
  /** The offset the day's instants were written in, for its clock times. */
  readonly offsetMinutes: number;
};

const startOf = (mark: TimelineMark): string =>
  'at' in mark ? mark.at : mark.start;
const endOf = (mark: TimelineMark): string =>
  'at' in mark ? mark.at : mark.end;

export const isPoint = (mark: TimelineMark): boolean => 'at' in mark;

/** The hours the block's marks fall in, or nothing for a timeline without marks. */
export const axisOf = (block: TimelineBlock): TimelineAxis | undefined => {
  let first: string | undefined;
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const group of block.groups) {
    for (const row of group.rows) {
      for (const mark of row.marks) {
        first ??= startOf(mark);
        low = Math.min(low, Date.parse(startOf(mark)));
        high = Math.max(high, Date.parse(endOf(mark)));
      }
    }
  }
  if (first === undefined || !Number.isFinite(low) || !Number.isFinite(high)) {
    return;
  }
  const offsetMinutes = offsetMinutesOf(first);
  const shift = offsetMinutes * millisecondsPerMinute;
  const start = Math.floor((low + shift) / hourMs) * hourMs - shift;
  const end = Math.max(
    start + hourMs,
    Math.ceil((high + shift) / hourMs) * hourMs - shift,
  );
  return { start, end, hours: (end - start) / hourMs, offsetMinutes };
};

const shareOf = (ms: number, axis: TimelineAxis): number =>
  Math.min(
    percent,
    Math.max(0, ((ms - axis.start) / (axis.end - axis.start)) * percent),
  );

export type MarkPlace = {
  /** From the axis's start, in percent of its length. */
  readonly left: number;
  /** In percent of the axis, or nothing for a mark at a moment. */
  readonly width?: number;
};

export const placeOf = (mark: TimelineMark, axis: TimelineAxis): MarkPlace => {
  const left = shareOf(Date.parse(startOf(mark)), axis);
  return isPoint(mark)
    ? { left }
    : { left, width: shareOf(Date.parse(endOf(mark)), axis) - left };
};

/** Where each part after the first begins, as dashed lines through every row. */
export const dividersOf = (
  block: TimelineBlock,
  axis: TimelineAxis,
): ReadonlyArray<number> =>
  block.groups
    .flatMap((group) => group.rows.flatMap((row) => row.marks))
    .flatMap((mark) => (mark.kind === 'part' ? [Date.parse(mark.start)] : []))
    .sort((a, b) => a - b)
    .slice(1)
    .map((at) => shareOf(at, axis));

const hoursPerDay = 24;
/** The steps that label the same hours every day: every hour, every second, and so on up to once a day. */
const labelSteps: ReadonlyArray<number> = Array.from(
  { length: hoursPerDay },
  (_, index) => index + 1,
).filter((step) => hoursPerDay % step === 0);
/** The room a clock label needs, "00:00" in the axis's type and a gap. */
export const labelSpacingPx = 48;
/** The width a timeline is drawn at before it is measured: about a phone's. */
export const unmeasuredTrackPx = 240;

/** Every how many hours the axis is labelled at a width of the drawing. */
export const labelStepOf = (hours: number, trackPx: number): number =>
  labelSteps.find((step) => (trackPx * step) / hours >= labelSpacingPx) ??
  labelSteps.at(-1) ??
  1;

export type AxisLabel = { readonly left: number; readonly text: string };

/** The hours on the clock that are a multiple of the step, as labels. */
export const axisLabelsOf = (
  axis: TimelineAxis,
  step: number,
): ReadonlyArray<AxisLabel> =>
  Array.from({ length: axis.hours }, (_, hour) => axis.start + hour * hourMs)
    .map((at) => ({ at, text: clockAt(at, axis.offsetMinutes) }))
    .filter(({ text }) => Number(text.slice(0, 2)) % step === 0)
    .map(({ at, text }) => ({ left: shareOf(at, axis), text }));

/** What the legend shows a mark as, with prompts from the phone apart. */
export type LegendKind = Exclude<TimelineMark['kind'], 'part'> | 'phonePrompt';

const legendOrder: ReadonlyArray<readonly [LegendKind, string]> = [
  ['screen', 'Your screen time'],
  ['focus', 'Focus'],
  ['run', 'Agent running'],
  ['prompt', 'Prompt'],
  ['phonePrompt', 'Prompt from the phone'],
  ['appointment', 'Appointment'],
  ['pullRequest', 'Pull request landed'],
  ['mail', 'Mail sent'],
];

export const legendKindOf = (mark: TimelineMark): LegendKind | undefined => {
  if (mark.kind === 'part') {
    return;
  }
  return mark.kind === 'prompt' && mark.fromPhone === true
    ? 'phonePrompt'
    : mark.kind;
};

/** The kinds of mark the timeline holds, in the legend's order. */
export const legendOf = (
  block: TimelineBlock,
): ReadonlyArray<readonly [LegendKind, string]> => {
  const present = new Set(
    block.groups.flatMap((group) =>
      group.rows.flatMap((row) => row.marks.map(legendKindOf)),
    ),
  );
  return legendOrder.filter(([kind]) => present.has(kind));
};

/** A row's marks in the order the arrow keys walk them: by time. */
export const walkOrderOf = (
  marks: ReadonlyArray<TimelineMark>,
): ReadonlyArray<number> =>
  marks
    .map((mark, index) => ({ index, at: Date.parse(startOf(mark)) }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map(({ index }) => index);

/** The middle of a mark, in percent of the axis. */
export const middleOf = (place: MarkPlace): number =>
  place.left + (place.width ?? 0) / 2;

/**
 * The mark nearest a point along a row, in percent of the axis. A moment
 * within reach comes first, so a prompt drawn on a run can be found; on a
 * span only within half the reach, so a short run that begins with its
 * prompt can be found as well. Then comes a span the point lies on, then the
 * closest span within reach, and of two at one distance the shorter.
 */
export const nearestMarkOf = (
  places: ReadonlyArray<MarkPlace>,
  at: number,
  reach: number,
): number | undefined => {
  const inReach = places
    .map((place, index) => ({
      index,
      span: place.width !== undefined,
      width: place.width ?? 0,
      distance: Math.max(
        0,
        place.left - at,
        at - (place.left + (place.width ?? 0)),
      ),
    }))
    .filter(({ distance }) => distance <= reach);
  const onSpan = inReach.some(({ span, distance }) => span && distance === 0);
  const momentReach = onSpan ? reach / 2 : reach;
  const moments = inReach.filter(
    ({ span, distance }) => !span && distance <= momentReach,
  );
  const [best] = (
    moments.length > 0 ? moments : inReach.filter(({ span }) => span)
  ).sort(
    (a, b) => a.distance - b.distance || a.width - b.width || a.index - b.index,
  );
  return best?.index;
};
