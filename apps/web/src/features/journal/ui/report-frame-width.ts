/**
 * The frame's side of the width messages it and its report exchange, and the
 * room the frame takes beside the text column, as the comment at the top of
 * `report-frame.tsx` describes.
 */

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useState } from 'react';

import {
  type ReportWidth,
  reportOffersWidthOf,
  reportWidthMessageOf,
  requestedReportWidthOf,
} from '../report-document.ts';

/** The screens wide enough to widen the timeline on: Tailwind's `lg`. */
const wideScreen = '(min-width: 64rem)';

/** The report's widest page, 1480px, and the frame's border at each side. */
const widestFrame = 1482;

/** The page's frame in rem, which the wide frame leaves of the screen. */
const pageFrameRem = 56;

/** The frame's border at its left and right, 1px each, which its width includes. */
const frameBorderWidth = 2;

/** How many pixels the room may lose so that it ends on whole device pixels. */
const mostGivenUp = 8;

/** How near a whole number of device pixels counts as one. */
const devicePixelSlack = 0.01;

/** A rem where the page doesn't say: the browser's own. */
const defaultRem = 16;

/**
 * How far the frame reaches out of the column on each side: as far as it
 * takes to reach the report's widest page, but no closer to the screen's edge
 * than the page's own margin. It is a whole number of pixels, so the report's
 * window is wider by exactly twice that, and its text stays on the same
 * pixels. Where a few pixels less make it a whole number of device pixels too,
 * as on a screen scaled by 1.5 or 5/3, it takes that, so the edges that slide
 * out to it end on the pixels the frame's own border is drawn on.
 */
export const reportRoomOf = ({
  column,
  screen,
  pageFrame,
  pixelRatio,
}: {
  /** The column's width, the frame's border included. */
  readonly column: number;
  readonly screen: number;
  readonly pageFrame: number;
  readonly pixelRatio: number;
}): number => {
  const most = Math.floor(
    Math.min(widestFrame - column, screen - pageFrame) / 2,
  );
  for (let room = most; room > Math.max(0, most - mostGivenUp); room -= 1) {
    const devicePixels = room * pixelRatio;
    if (Math.abs(devicePixels - Math.round(devicePixels)) < devicePixelSlack) {
      return room;
    }
  }
  return Math.max(0, most);
};

/** Whether a message came from the report in this frame, and not from anything else on the page. */
export const isFromFrame = (
  frameRef: RefObject<HTMLIFrameElement | null>,
  event: MessageEvent,
): boolean => {
  const own = frameRef.current?.contentWindow;
  return own !== null && own !== undefined && event.source === own;
};

type Screen = {
  readonly width: number;
  readonly pageFrame: number;
  readonly pixelRatio: number;
  readonly roomToWiden: boolean;
};

const screenNow = (): Screen | undefined => {
  if (globalThis.matchMedia === undefined) {
    return;
  }
  const rem = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return {
    width: globalThis.innerWidth,
    pageFrame: pageFrameRem * (Number.isFinite(rem) ? rem : defaultRem),
    pixelRatio: globalThis.devicePixelRatio,
    roomToWiden: globalThis.matchMedia(wideScreen).matches,
  };
};

const sameScreen = (a: Screen | undefined, b: Screen | undefined): boolean =>
  a?.width === b?.width &&
  a?.pageFrame === b?.pageFrame &&
  a?.pixelRatio === b?.pixelRatio &&
  a?.roomToWiden === b?.roomToWiden;

/**
 * The screen's width and pixel ratio, again whenever either changes: the
 * window is resized or zoomed, or moved to a screen scaled differently, which
 * changes the ratio alone.
 */
const useScreen = (): Screen | undefined => {
  const [screen, setScreen] = useState<Screen>();
  useEffect(() => {
    let resolution: MediaQueryList | undefined;
    const measure = (): void => {
      const now = screenNow();
      setScreen((before) => (sameScreen(before, now) ? before : now));
      resolution?.removeEventListener('change', measure);
      resolution = globalThis.matchMedia?.(
        `(resolution: ${globalThis.devicePixelRatio}dppx)`,
      );
      resolution?.addEventListener('change', measure);
    };
    measure();
    globalThis.addEventListener('resize', measure);
    return () => {
      globalThis.removeEventListener('resize', measure);
      resolution?.removeEventListener('change', measure);
    };
  }, []);
  return screen;
};

type ReportFrameWidthOptions = {
  /** The frame's box, which sits in the column. */
  readonly boxRef: RefObject<HTMLElement | null>;
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  /** How many documents the frame has loaded; only the first is the report. */
  readonly loadsRef: RefObject<number>;
  /** The width chosen last, which a report with a control is shown at. */
  readonly wide: boolean;
  readonly onWidthRequest: (width: ReportWidth) => void;
};

export const useReportFrameWidth = ({
  boxRef,
  frameRef,
  loadsRef,
  wide,
  onWidthRequest,
}: ReportFrameWidthOptions): {
  /** Starts telling the report about the width, which the frame does once it loads. */
  readonly reportLoaded: () => void;
  /**
   * How far the frame reaches out of the column on each side, or undefined
   * while it keeps to the column.
   */
  readonly room: number | undefined;
} => {
  const [loaded, setLoaded] = useState(false);
  const [holderWidth, setHolderWidth] = useState<number>();
  const [offersWidth, setOffersWidth] = useState(false);
  const screen = useScreen();

  useEffect(() => {
    const holder = boxRef.current?.parentElement;
    if (!loaded || holder === null || holder === undefined) {
      return;
    }
    // The column is the box's holder, whose width doesn't change when the box
    // reaches out of it.
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setHolderWidth(entry.contentRect.width);
      }
    });
    observer.observe(holder);
    return () => observer.disconnect();
  }, [boxRef, loaded]);

  const room =
    holderWidth === undefined || screen === undefined
      ? 0
      : reportRoomOf({
          column: holderWidth,
          screen: screen.width,
          pageFrame: screen.pageFrame,
          pixelRatio: screen.pixelRatio,
        });
  const available = screen?.roomToWiden === true && room > 0;

  useEffect(() => {
    const target = frameRef.current?.contentWindow;
    if (
      holderWidth === undefined ||
      target === null ||
      target === undefined ||
      loadsRef.current !== 1
    ) {
      return;
    }
    // As with the numbers, `*` is the only target origin that reaches the
    // sandboxed report, and the load count keeps it to the first document.
    target.postMessage(
      reportWidthMessageOf(available, wide, holderWidth - frameBorderWidth),
      '*',
    );
  }, [frameRef, loadsRef, holderWidth, available, wide]);

  const requestWidth = useEffectEvent((width: ReportWidth): void => {
    if (offersWidth && available) {
      onWidthRequest(width);
    }
  });

  useEffect(() => {
    const hear = (event: MessageEvent): void => {
      if (!isFromFrame(frameRef, event)) {
        return;
      }
      if (reportOffersWidthOf(event.data)) {
        setOffersWidth(true);
        return;
      }
      const requested = requestedReportWidthOf(event.data);
      if (requested !== undefined) {
        requestWidth(requested);
      }
    };
    globalThis.addEventListener('message', hear);
    return () => globalThis.removeEventListener('message', hear);
  }, [frameRef]);

  return {
    reportLoaded: () => setLoaded(true),
    room: offersWidth && available ? room : undefined,
  };
};
