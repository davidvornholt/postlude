/**
 * How the day report's timeline widens out of the text column, and back.
 *
 * The timeline's figure sits in a slot in the column. Wide, it reaches from
 * the window's left edge to its right, less the page's own margin at each
 * side, wherever the column happens to be, so it may reach further out on one
 * side than on the other. Nothing else on the page moves, since the slot keeps
 * its place. The figure's edges are set on whole device pixels, measured again
 * whenever the window, the page's scrollbar or the column changes, and set
 * straight on the figure, so they are right in the very frame that needs them.
 *
 * Only a press moves the figure gradually, and with reduced motion it moves at
 * once. Widening is there only on screens of Tailwind's `lg` and wider, where
 * the control shows: a narrower screen gives the column all the room there
 * is. The breakpoint is the stylesheet's alone, so the figure is wide or not
 * in the very frame the window crosses it.
 */

import { useLayoutEffect, useState } from 'react';

/** The room the wide timeline leaves at each side, the page's own margin, in rem. */
const marginRem = 2;

/** A rem where the page doesn't say: the browser's own. */
const defaultRem = 16;

/** Where the wide figure's edges go, as a shift from the slot and a width, in CSS pixels. */
export type WideFigure = { readonly shift: number; readonly width: number };

/**
 * The wide figure's place: from the margin at the window's left to the margin
 * at its right, both on whole device pixels, but never narrower than the slot
 * nor to the right of it.
 */
export const wideFigureOf = ({
  slotLeft,
  slotWidth,
  window,
  margin,
  pixelRatio,
}: {
  readonly slotLeft: number;
  readonly slotWidth: number;
  /** The window's width less its scrollbar. */
  readonly window: number;
  readonly margin: number;
  readonly pixelRatio: number;
}): WideFigure => {
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const snap = (px: number): number => Math.round(px * ratio) / ratio;
  const left = Math.min(snap(margin), slotLeft);
  const right = Math.max(snap(window - margin), slotLeft + slotWidth);
  return { shift: left - slotLeft, width: right - left };
};

const rootRem = (): number => {
  const rem = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return Number.isFinite(rem) ? rem : defaultRem;
};

/** Whether the figure is still moving after a press, held with the press it belongs to. */
const useMoving = (wide: boolean, figure: HTMLElement | null): boolean => {
  const [state, setState] = useState({ wide, moving: false });
  if (state.wide !== wide) {
    setState({ wide, moving: true });
  }
  const { moving } = state;
  useLayoutEffect(() => {
    if (!moving || figure === null) {
      return;
    }
    let current = true;
    const settle = () => {
      if (current) {
        setState((settling) =>
          settling.wide === wide ? { ...settling, moving: false } : settling,
        );
      }
    };
    // As in `collapsible.tsx`: reading the animations brings the style up to
    // date first, and with none running, as with reduced motion, it settles.
    Promise.all(figure.getAnimations().map(({ finished }) => finished)).then(
      settle,
      settle,
    );
    return () => {
      current = false;
    };
  }, [moving, wide, figure]);
  return moving;
};

export const useTimelineWidth = (
  wide: boolean,
): {
  readonly slotRef: (element: HTMLDivElement | null) => void;
  readonly figureRef: (element: HTMLElement | null) => void;
  /** The figure's classes for its width now. */
  readonly figureClass: string;
} => {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const moving = useMoving(wide, figure);

  useLayoutEffect(() => {
    if (slot === null || figure === null) {
      return;
    }
    const measure = (): void => {
      const box = slot.getBoundingClientRect();
      const { shift, width } = wideFigureOf({
        slotLeft: box.left,
        slotWidth: box.width,
        window: document.documentElement.clientWidth,
        margin: marginRem * rootRem(),
        pixelRatio: globalThis.devicePixelRatio,
      });
      figure.style.setProperty('--timeline-shift', `${shift}px`);
      figure.style.setProperty('--timeline-wide', `${width}px`);
    };
    measure();
    // The root's box changes with the window and with the page's scrollbar,
    // which moves the column without resizing the window.
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    observer.observe(document.documentElement);
    globalThis.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      globalThis.removeEventListener('resize', measure);
    };
  }, [slot, figure]);

  return {
    slotRef: setSlot,
    figureRef: setFigure,
    figureClass: [
      'relative ml-0 w-full max-w-none',
      wide ? 'lg:ml-(--timeline-shift) lg:w-(--timeline-wide)' : '',
      moving
        ? 'motion-safe:transition-[margin-left,width] motion-safe:duration-300 motion-safe:ease-standard'
        : '',
    ].join(' '),
  };
};
