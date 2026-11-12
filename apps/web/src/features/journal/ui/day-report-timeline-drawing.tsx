/**
 * The timeline itself: an axis of the day's hours, and under it a row of
 * marks for each part, area, thread and kind of event, grouped as /wrap
 * grouped them. Every mark is placed in percent of the axis, so the drawing
 * follows its width, and the axis labels as many hours as fit.
 *
 * To assistive technology the drawing is one focusable group whose marks are
 * read out one at a time as the arrow keys reach them; the day in parts says
 * the same in words. A ring and a card show the mark a reader has reached, by
 * pointer, touch or keyboard (`use-timeline-marks.ts`).
 */

import {
  memo,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { minutesText } from '../day-report-format.ts';
import { cardOf, cardText } from '../day-report-timeline-cards.ts';
import {
  axisLabelsOf,
  dividersOf,
  labelStepOf,
  legendKindOf,
  type MarkPlace,
  placeOf,
  type TimelineAxis,
  unmeasuredTrackPx,
} from '../day-report-timeline-layout.ts';
import type {
  TimelineBlock,
  TimelineMark,
  TimelineRow,
} from '../schemas/day-report-timeline.ts';
import { markShapeClass } from './day-report-timeline-classes.ts';
import { useTimelineMarks } from './use-timeline-marks.ts';

/** Enough decimals of a percent to place a mark within a device pixel on any screen. */
const percentDigits = 3;
const percentText = (value: number): string =>
  `${Number(value.toFixed(percentDigits))}%`;

const Mark = ({
  mark,
  place,
  id,
}: {
  readonly mark: TimelineMark;
  readonly place: MarkPlace;
  readonly id: string;
}) => (
  <span
    className={`absolute ${place.width === undefined ? '' : 'min-w-0.5'} ${markShapeClass[legendKindOf(mark) ?? 'part']}`}
    data-mark={id}
    // biome-ignore lint/nursery/noInlineStyles: a mark's place on the axis is data.
    style={{
      left: percentText(place.left),
      width: place.width === undefined ? undefined : percentText(place.width),
    }}
  >
    {mark.kind === 'part' ? mark.number : null}
  </span>
);

/**
 * A row's label beside its track. The label's share of the drawing grows with
 * it, between bounds, rather than in steps, so the tracks stretch evenly as
 * the timeline widens.
 */
const rowGridClass =
  'grid grid-cols-[clamp(7.5rem,25cqi,15rem)_1fr] items-center gap-x-3';

const Row = memo(function TrackRow({
  row,
  index,
  axis,
  dividers,
}: {
  readonly row: TimelineRow;
  readonly index: number;
  readonly axis: TimelineAxis;
  readonly dividers: ReadonlyArray<number>;
}) {
  return (
    <div className={rowGridClass}>
      <span className="flex min-w-0 items-baseline justify-between gap-2 text-ink-muted text-xs">
        <span className="truncate">{row.label}</span>
        {row.total === undefined ? null : (
          <span className="shrink-0 text-ink-faint tabular-nums">
            {minutesText(row.total.minutes)}
          </span>
        )}
      </span>
      <span
        className="relative block h-[18px] border-border border-b"
        data-track={index}
      >
        {dividers.map((left, dividerIndex) => (
          <span
            className="absolute inset-y-0 border-ink-faint border-l border-dashed opacity-50"
            // biome-ignore lint/suspicious/noArrayIndexKey: two parts may begin at one place, and dividers never move.
            key={dividerIndex}
            // biome-ignore lint/nursery/noInlineStyles: a divider's place on the axis is data.
            style={{ left: percentText(left) }}
          />
        ))}
        {row.marks.map((mark, markIndex) => (
          <Mark
            id={`${index}:${markIndex}`}
            // biome-ignore lint/suspicious/noArrayIndexKey: a stored row's marks never move.
            key={markIndex}
            mark={mark}
            place={placeOf(mark, axis)}
          />
        ))}
      </span>
    </div>
  );
});

const Axis = ({
  axis,
  step,
}: {
  readonly axis: TimelineAxis;
  readonly step: number;
}) => (
  <div className={rowGridClass}>
    <span />
    <span className="relative block h-4 text-[11px] text-ink-muted tabular-nums">
      {axisLabelsOf(axis, step).map((label, labelIndex) => (
        <span
          className={`absolute top-0 ${label.left === 0 ? '' : '-translate-x-1/2'}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: a day from 04:00 to 04:00 labels 04:00 twice.
          key={labelIndex}
          // biome-ignore lint/nursery/noInlineStyles: a label's place on the axis is data.
          style={{ left: percentText(label.left) }}
        >
          {label.text}
        </span>
      ))}
    </span>
  </div>
);

const cardGapPx = 6;
const ringPx = 3;

/** Puts the card under the mark it is for, kept inside the drawing, and the ring around the mark. */
const usePlacedCard = (
  drawing: HTMLDivElement | null,
  card: HTMLDivElement | null,
  ring: HTMLSpanElement | null,
  markId: string | undefined,
): void => {
  useLayoutEffect(() => {
    const mark =
      markId === undefined
        ? null
        : drawing?.querySelector(`[data-mark="${markId}"]`);
    if (drawing === null || card === null || ring === null || !mark) {
      return;
    }
    const frame = drawing.getBoundingClientRect();
    const box = mark.getBoundingClientRect();
    const middle = box.left + box.width / 2 - frame.left;
    const left = Math.min(
      Math.max(0, middle - card.offsetWidth / 2),
      Math.max(0, frame.width - card.offsetWidth),
    );
    card.style.left = `${left}px`;
    card.style.top = `${box.bottom - frame.top + cardGapPx}px`;
    ring.style.left = `${box.left - frame.left - ringPx}px`;
    ring.style.top = `${box.top - frame.top - ringPx}px`;
    ring.style.width = `${box.width + 2 * ringPx}px`;
    ring.style.height = `${box.height + 2 * ringPx}px`;
  });
};

/** How wide the tracks are, measured again as the drawing widens or narrows. */
const useTrackWidth = (drawing: HTMLDivElement | null): number => {
  const [width, setWidth] = useState(unmeasuredTrackPx);
  useLayoutEffect(() => {
    const track = drawing?.querySelector('[data-track]');
    if (!track) {
      return;
    }
    const measure = () => setWidth(track.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [drawing]);
  return width;
};

export const TimelineDrawing = ({
  block,
  axis,
  label,
}: {
  readonly block: TimelineBlock;
  readonly axis: TimelineAxis;
  readonly label: string;
}) => {
  const rows = useMemo(
    () => block.groups.flatMap((group) => group.rows),
    [block],
  );
  const dividers = useMemo(() => dividersOf(block, axis), [block, axis]);
  const marks = useTimelineMarks(rows, axis);
  const [drawing, setDrawing] = useState<HTMLDivElement | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [ring, setRing] = useState<HTMLSpanElement | null>(null);
  const hintId = useId();
  const { active, drawingRef, cardRef } = marks;
  const attachDrawing = useCallback(
    (element: HTMLDivElement | null) => {
      drawingRef.current = element;
      setDrawing(element);
    },
    [drawingRef],
  );
  const attachCard = useCallback(
    (element: HTMLDivElement | null) => {
      cardRef.current = element;
      setCard(element);
    },
    [cardRef],
  );
  const activeRow = active === undefined ? undefined : rows[active.row];
  const activeMark = activeRow?.marks[active?.mark ?? -1];
  const shown =
    activeRow === undefined || activeMark === undefined
      ? undefined
      : cardOf(activeMark, activeRow);
  const markId =
    shown === undefined ? undefined : `${active?.row}:${active?.mark}`;
  usePlacedCard(drawing, card, ring, markId);
  const step = labelStepOf(axis.hours, useTrackWidth(drawing));

  let rowIndex = 0;
  const groups: Array<ReactNode> = block.groups.map((group, groupIndex) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: titles may repeat, and a stored timeline's groups never move.
    <div key={groupIndex}>
      <p className="mt-3 mb-1 text-ink-faint text-xs">{group.title}</p>
      {group.rows.map((row) => {
        const index = rowIndex;
        rowIndex += 1;
        return (
          <Row
            axis={axis}
            dividers={dividers}
            index={index}
            key={`${row.label}-${index}`}
            row={row}
          />
        );
      })}
    </div>
  ));

  return (
    <div className="@container relative">
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls, and this is a drawing. */}
      <div
        aria-describedby={hintId}
        aria-label={label}
        className="relative cursor-default select-none outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
        ref={attachDrawing}
        role="group"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: one focusable group exposes the drawing without placing every mark in the tab order.
        tabIndex={0}
        {...marks.drawingHandlers}
      >
        <div aria-hidden={true}>
          <Axis axis={axis} step={step} />
          {groups}
        </div>
        <span
          aria-hidden={true}
          className={`pointer-events-none absolute outline-2 outline-primary ${shown === undefined || active?.via === 'pointer' ? 'hidden' : ''}`}
          ref={setRing}
        />
      </div>
      <p className="sr-only" id={hintId}>
        The day in parts describes the day in words. Use the arrow keys to read
        the timeline's marks one at a time.
      </p>
      <p aria-live="polite" className="sr-only">
        {shown === undefined || active?.via === 'pointer'
          ? ''
          : cardText(shown)}
      </p>
      <div
        aria-hidden={true}
        className={`absolute z-40 w-max max-w-[min(20rem,100%)] bg-ink px-3 py-2 text-background text-xs leading-normal ${shown === undefined ? 'hidden' : ''}`}
        ref={attachCard}
        {...marks.cardHandlers}
      >
        {shown === undefined ? null : (
          <>
            <p className="font-semibold">{shown.title}</p>
            {shown.lines.map((line, lineIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two pull requests may share a title.
              <p className="opacity-85" key={lineIndex}>
                {line}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
