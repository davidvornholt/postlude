/**
 * The frame's side of the width messages it and its report exchange, as the
 * comment at the top of `report-frame.tsx` describes.
 */

import type { RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useState,
} from 'react';

import {
  reportOffersWidthOf,
  reportWidthMessageOf,
  requestedReportWidthOf,
} from '../report-document.ts';
import type { ReportWidth } from '../report-width.ts';

/** The screens wide enough to widen the frame on: Tailwind's `lg`, as `wideClass` has it. */
const wideScreen = '(min-width: 64rem)';

/** Wide from the width at which the wide frame gains the report real room. */
const wideClass = 'lg:[--report-wide:1]';

/**
 * How long the height and the width take to change. The first width the
 * frame takes, once the report has said it has a control, it takes at once:
 * a report that opens wide should open wide, not widen while it opens.
 */
const settlingDurations = '[transition-duration:300ms,0s]';
const movingDurations = '[transition-duration:300ms,400ms]';

/** Whether a message came from the report in this frame, and not from anything else on the page. */
export const isFromFrame = (
  frameRef: RefObject<HTMLIFrameElement | null>,
  event: MessageEvent,
): boolean => {
  const own = frameRef.current?.contentWindow;
  return own !== null && own !== undefined && event.source === own;
};

type ReportFrameWidthOptions = {
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  /** How many documents the frame has loaded; only the first is the report. */
  readonly loadsRef: RefObject<number>;
  /** The width chosen last, which a report with a control is shown at. */
  readonly wide: boolean;
  readonly onWidthRequest: (width: ReportWidth) => void;
};

export const useReportFrameWidth = ({
  frameRef,
  loadsRef,
  wide,
  onWidthRequest,
}: ReportFrameWidthOptions): {
  /** Tells the report about the width, which the frame does once it loads. */
  readonly postWidth: () => void;
  /** The frame's width and how it moves. */
  readonly widthClass: string;
} => {
  const [roomToWiden, setRoomToWiden] = useState(false);
  const [offersWidth, setOffersWidth] = useState(false);
  const [widthMoves, setWidthMoves] = useState(false);

  const postWidth = useCallback(() => {
    const target = frameRef.current?.contentWindow;
    if (
      !offersWidth ||
      target === null ||
      target === undefined ||
      loadsRef.current !== 1
    ) {
      return;
    }
    // As with the numbers, `*` is the only target origin that reaches the
    // sandboxed report, and the load count keeps it to the first document.
    target.postMessage(reportWidthMessageOf(roomToWiden, wide), '*');
  }, [frameRef, loadsRef, offersWidth, roomToWiden, wide]);

  useEffect(() => {
    const screen = globalThis.matchMedia?.(wideScreen);
    if (screen === undefined) {
      return;
    }
    const measure = (): void => setRoomToWiden(screen.matches);
    measure();
    screen.addEventListener('change', measure);
    return () => screen.removeEventListener('change', measure);
  }, []);

  useEffect(() => {
    postWidth();
  }, [postWidth]);

  useLayoutEffect(() => {
    if (!offersWidth || widthMoves) {
      return;
    }
    // Reading the frame's box makes the browser take its first width before
    // the width may move, so it starts there rather than moving to it.
    frameRef.current?.getBoundingClientRect();
    setWidthMoves(true);
  }, [frameRef, offersWidth, widthMoves]);

  const requestWidth = useEffectEvent((width: ReportWidth): void => {
    if (offersWidth && roomToWiden) {
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
    postWidth,
    widthClass: [
      widthMoves ? movingDurations : settlingDurations,
      wide && offersWidth ? wideClass : '',
    ].join(' '),
  };
};
