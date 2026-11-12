/**
 * Which of the timeline's marks shows its card, and how a reader picks one:
 * by pointing at it, by tapping it, or with the arrow keys once the drawing
 * has focus.
 *
 * A pointer shows the card of the mark nearest it, and the card stays while
 * the pointer moves onto it, so it can be read and its words selected; it goes
 * a moment after the pointer leaves both. A tap shows a mark's card and a
 * second tap, or one anywhere else, hides it, and so does scrolling. A mouse
 * press never keeps a card: it stays only while the pointer does. From the
 * keyboard, which shows a card only on focus that `:focus-visible` matches,
 * Left and Right walk a row by time, Up and Down move to the nearest mark in
 * the row above or below, and Home and End go to a row's first and last mark;
 * what a card says is also read out. Escape hides a card however it was shown
 * (WCAG 1.4.13).
 */

import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type MarkPlace,
  middleOf,
  nearestMarkOf,
  placeOf,
  type TimelineAxis,
  walkOrderOf,
} from '../day-report-timeline-layout.ts';
import type { TimelineRow } from '../schemas/day-report-timeline.ts';

export type MarkAt = { readonly row: number; readonly mark: number };

export type ActiveMark = MarkAt & {
  readonly via: 'pointer' | 'touch' | 'keyboard';
};

/** How far from a mark, in CSS pixels, a pointer still finds it. */
const pointerReachPx = 10;
/** How long a card stays after the pointer leaves it and its mark. */
const hideDelayMs = 300;
const percent = 100;

const sameMark = (a: MarkAt | undefined, b: MarkAt | undefined): boolean =>
  a?.row === b?.row && a?.mark === b?.mark;

const rowsWithMarks = (rows: ReadonlyArray<TimelineRow>) =>
  rows.flatMap((row, index) => (row.marks.length > 0 ? [index] : []));

const nearestIn = (
  places: ReadonlyArray<MarkPlace>,
  middle: number,
): number | undefined => {
  let best: { index: number; distance: number } | undefined;
  places.forEach((place, index) => {
    const distance = Math.abs(middleOf(place) - middle);
    if (best === undefined || distance < best.distance) {
      best = { index, distance };
    }
  });
  return best?.index;
};

/** The order each row's marks are walked in, and where each mark is. */
type MarkMap = {
  readonly rows: ReadonlyArray<TimelineRow>;
  readonly walks: ReadonlyArray<ReadonlyArray<number>>;
  readonly places: ReadonlyArray<ReadonlyArray<MarkPlace>>;
};

const firstMarkOf = ({ rows, walks }: MarkMap): MarkAt | undefined => {
  const [row] = rowsWithMarks(rows);
  const mark = row === undefined ? undefined : walks[row]?.[0];
  return row === undefined || mark === undefined ? undefined : { row, mark };
};

/** The mark above or below, nearest in time to the one a reader is on. */
const acrossRows = (
  { rows, places }: MarkMap,
  from: MarkAt,
  down: boolean,
): MarkAt => {
  const candidates = rowsWithMarks(rows);
  const row = candidates[candidates.indexOf(from.row) + (down ? 1 : -1)];
  const middle = middleOf(places[from.row]?.[from.mark] ?? { left: 0 });
  const mark =
    row === undefined ? undefined : nearestIn(places[row] ?? [], middle);
  return row === undefined || mark === undefined ? from : { row, mark };
};

/** Where a key moves a reader from a mark, or nothing for a key that doesn't move. */
const movedBy = (
  map: MarkMap,
  key: string,
  from: MarkAt,
): MarkAt | undefined => {
  const walk = map.walks[from.row] ?? [];
  const position = walk.indexOf(from.mark);
  const inRow = (mark: number | undefined) =>
    mark === undefined ? from : { row: from.row, mark };
  switch (key) {
    case 'ArrowRight':
      return inRow(walk[position + 1]);
    case 'ArrowLeft':
      return inRow(walk[position - 1]);
    case 'Home':
      return inRow(walk[0]);
    case 'End':
      return inRow(walk.at(-1));
    case 'ArrowDown':
    case 'ArrowUp':
      return acrossRows(map, from, key === 'ArrowDown');
    default:
      return;
  }
};

/**
 * Hides a card a pointer or a tap showed when the reader taps elsewhere,
 * presses Escape or scrolls, without the pointer having to move.
 */
const useDismissal = (
  active: ActiveMark | undefined,
  hide: () => void,
  inside: (target: Node | null) => boolean,
): void => {
  useEffect(() => {
    if (active === undefined || active.via === 'keyboard') {
      return;
    }
    const outside = (event: globalThis.PointerEvent): void => {
      if (!inside(event.target as Node | null)) {
        hide();
      }
    };
    const onEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        hide();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', onEscape);
    document.addEventListener('scroll', hide, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('scroll', hide, { capture: true });
    };
  }, [active, hide, inside]);
};

/** The mark nearest a pointer on a track, if one is within its reach. */
const markAtPointerOf = (
  places: ReadonlyArray<ReadonlyArray<MarkPlace>>,
  event: PointerEvent,
): MarkAt | undefined => {
  const track = (event.target as Element).closest<HTMLElement>('[data-track]');
  const row = Number(track?.dataset.track);
  const rect = track?.getBoundingClientRect();
  if (rect === undefined || rect.width === 0 || !Number.isInteger(row)) {
    return;
  }
  const at = ((event.clientX - rect.left) / rect.width) * percent;
  const mark = nearestMarkOf(
    places[row] ?? [],
    at,
    (pointerReachPx / rect.width) * percent,
  );
  return mark === undefined ? undefined : { row, mark };
};

/** The mark whose card shows, and a card that goes a moment after the pointer leaves. */
const useShownMark = () => {
  const [active, setActive] = useState<ActiveMark>();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((next: ActiveMark | undefined) => {
    clearTimeout(hideTimerRef.current);
    setActive((current) =>
      sameMark(current, next) && current?.via === next?.via ? current : next,
    );
  }, []);
  const hide = useCallback(() => setActive(undefined), []);
  const hideSoon = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setActive(undefined), hideDelayMs);
  }, []);
  const keepCard = useCallback(() => clearTimeout(hideTimerRef.current), []);
  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  return { active, show, hide, hideSoon, keepCard };
};

export const useTimelineMarks = (
  rows: ReadonlyArray<TimelineRow>,
  axis: TimelineAxis,
) => {
  const { active, show, hide, hideSoon, keepCard } = useShownMark();
  const drawingRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const walks = useMemo(
    () => rows.map((row) => walkOrderOf(row.marks)),
    [rows],
  );
  const places = useMemo(
    () => rows.map((row) => row.marks.map((mark) => placeOf(mark, axis))),
    [rows, axis],
  );
  const map: MarkMap = { rows, walks, places };

  const inside = useCallback(
    (target: Node | null) =>
      drawingRef.current?.contains(target) === true ||
      cardRef.current?.contains(target) === true,
    [],
  );
  useDismissal(active, hide, inside);

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      return;
    }
    const found = markAtPointerOf(places, event);
    if (found !== undefined) {
      show({ ...found, via: 'pointer' });
    } else if (active?.via === 'pointer') {
      hideSoon();
    }
  };

  const onPointerLeave = (): void => {
    if (active?.via === 'pointer') {
      hideSoon();
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      return;
    }
    const found = markAtPointerOf(places, event);
    show(
      found === undefined || sameMark(found, active)
        ? undefined
        : { ...found, via: 'touch' },
    );
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      show(undefined);
      return;
    }
    const from = active ?? firstMarkOf(map);
    const next = from === undefined ? undefined : movedBy(map, event.key, from);
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    show({ ...next, via: 'keyboard' });
  };

  const onFocus = (event: FocusEvent<HTMLElement>): void => {
    if (
      event.target === event.currentTarget &&
      active === undefined &&
      event.currentTarget.matches(':focus-visible')
    ) {
      const first = firstMarkOf(map);
      show(first === undefined ? undefined : { ...first, via: 'keyboard' });
    }
  };

  const onBlur = (): void => {
    if (active?.via === 'keyboard') {
      show(undefined);
    }
  };

  return {
    active,
    drawingRef,
    cardRef,
    drawingHandlers: {
      onBlur,
      onFocus,
      onKeyDown,
      onPointerLeave,
      onPointerMove,
      onPointerUp,
    },
    cardHandlers: { onPointerEnter: keepCard, onPointerLeave: hideSoon },
  };
};
