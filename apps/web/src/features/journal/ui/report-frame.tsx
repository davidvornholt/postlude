/**
 * The day's /wrap report, in a frame that keeps it apart from the journal.
 *
 * The frame is sandboxed with scripts allowed and nothing else: no same
 * origin, so the report can't read the page, its cookies or its storage; and
 * no forms, popups or navigation of the page. The policy `reportDocumentOf`
 * adds refuses the requests the report's document makes, such as a fetch, an
 * image or a stylesheet. It can't refuse a navigation of the frame itself,
 * which a sandbox always allows, so the page gets `frame-src 'none'` of its own
 * before the frame mounts. The report's `srcdoc` still loads under that, but
 * the frame can't be navigated to any address that has to be fetched.
 *
 * Its numbers arrive in one message after it has loaded, together with the
 * page's colour scheme, and again whenever the scheme changes. The frame grows
 * to the height the report asks for, but only when the request comes from this
 * frame's own window, and only within bounds, and it eases to that height so
 * what follows it slides rather than jumps.
 *
 * A report that navigates its frame anyway has stopped being the report, so
 * the frame is taken down when it loads again and nothing more is sent to it.
 *
 * The frame sits in the text column, and where the screen is wide enough the
 * report's timeline can be shown wide, because it can use more width than the
 * column has. The control for that is the report's own, beside its timeline.
 * Once the report has loaded, the frame tells it how wide it is in the column,
 * whether the screen has room to widen the timeline and whether it is wide,
 * and tells it again whenever any of that changes. A report with a control
 * keeps everything at the column's width, in the middle of its page, and its
 * timeline too until it is told the timeline is wide, and only then says it
 * has the control, which it shows only while there is room. A press asks for
 * a width, which the frame takes only from its own report and only while there
 * is room.
 *
 * For a report that has said it has the control, and while there is room, the
 * frame reaches out of the column by the same whole number of pixels on each
 * side (`reportRoomOf`), as far as the template's widest page, 1480px and its
 * border, but no closer to the screen's edge than the page's own margin. The
 * report's page is wider by exactly that, so everything it keeps in the middle
 * stays on the pixels it had in the column. That is the only time the frame
 * changes its width, and a report without a control never does.
 *
 * Two covers in the page's own colour hide what the frame has beyond the
 * column, each with a line where the column's border is. Showing the timeline
 * wide slides them out to the frame's own border, and narrowing it slides them
 * back, while the report cross-fades its timeline between the two widths. Only
 * the covers move, on the compositor, so nothing is laid out again while they
 * do, and with reduced motion they move at once.
 */

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  dayMetricsMessageOf,
  type ReportTheme,
  type ReportWidth,
  reportDocumentOf,
  reportHeightBounds,
  reportHeightOf,
} from '../report-document.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { isFromFrame, useReportFrameWidth } from './report-frame-width.ts';

type ReportFrameProps = {
  readonly reportHtml: string;
  /**
   * Whether the timeline is wide, where the screen is wide enough and the
   * report has a width control; it is in the text column elsewhere.
   */
  readonly wide: boolean;
  /** The width the report's control asks for. */
  readonly onWidthRequest: (width: ReportWidth) => void;
  readonly dayMetrics: DayMetrics;
  readonly metricsVersion: number;
};

const darkScheme = '(prefers-color-scheme: dark)';

const framePolicy = "frame-src 'none'";

/**
 * A policy is enforced from the moment its meta element is in the head until
 * the page is gone, even if the element is removed, so it is added only once.
 */
const addFramePolicy = (): void => {
  const selector = `meta[http-equiv="Content-Security-Policy"][content="${framePolicy}"]`;
  if (document.head.querySelector(selector) !== null) {
    return;
  }
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = framePolicy;
  document.head.append(meta);
};

/**
 * The box reaches `--report-room` out of the column on each side; a
 * percentage is the column's width.
 */
const roomyBoxClass =
  'ml-[calc(-1_*_var(--report-room))] w-[calc(100%_+_2_*_var(--report-room))]';

/**
 * A cover over what the frame has beyond the column on one side, with the
 * column's border on its inner edge. It slides out of the box, which clips
 * it, until that line lies on the frame's own border. It is a layer of its
 * own all along, so it starts and stops moving without being drawn again.
 */
const coverClass =
  'absolute inset-y-0 w-(--report-room) bg-background transition-[translate] duration-400 ease-standard will-change-transform motion-reduce:transition-none';
const leftCoverClass = `${coverClass} left-0 after:absolute after:inset-y-0 after:left-full after:border-border after:border-l`;
const rightCoverClass = `${coverClass} right-0 before:absolute before:inset-y-0 before:right-full before:border-border before:border-r`;

/**
 * The frame's border above and below the report, 1px each, which the frame's
 * height includes. Added to the height the report asked for, it leaves the
 * report all of that height, so it never has a pixel to scroll.
 */
const frameBorderHeight = 2;

const pageTheme = (): ReportTheme =>
  globalThis.matchMedia?.(darkScheme).matches === true ? 'dark' : 'light';

export const ReportFrame = ({
  reportHtml,
  wide,
  onWidthRequest,
  dayMetrics,
  metricsVersion,
}: ReportFrameProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadsRef = useRef(0);
  const [height, setHeight] = useState<number>(reportHeightBounds.initial);
  const [navigatedAway, setNavigatedAway] = useState(false);
  const [framePolicyAdded, setFramePolicyAdded] = useState(false);
  const { reportLoaded, room } = useReportFrameWidth({
    boxRef,
    frameRef,
    loadsRef,
    wide,
    onWidthRequest,
  });
  const srcDoc = useMemo(() => reportDocumentOf(reportHtml), [reportHtml]);

  /** Sends the numbers, only ever to the report's first document. */
  const post = useCallback(() => {
    const target = frameRef.current?.contentWindow;
    if (target === null || target === undefined || loadsRef.current !== 1) {
      return;
    }
    // The sandboxed document's origin is opaque, so `*` is the only target
    // origin that reaches it. The load count above is what keeps a page the
    // frame navigated to from receiving the numbers.
    target.postMessage(
      dayMetricsMessageOf(dayMetrics, metricsVersion, pageTheme()),
      '*',
    );
  }, [dayMetrics, metricsVersion]);

  useEffect(() => {
    addFramePolicy();
    setFramePolicyAdded(true);
  }, []);

  useEffect(() => {
    const resize = (event: MessageEvent): void => {
      if (!isFromFrame(frameRef, event)) {
        return;
      }
      const requested = reportHeightOf(event.data);
      if (requested !== undefined) {
        setHeight(requested);
      }
    };
    globalThis.addEventListener('message', resize);
    return () => globalThis.removeEventListener('message', resize);
  }, []);

  useEffect(() => {
    const scheme = globalThis.matchMedia?.(darkScheme);
    if (scheme === undefined) {
      return;
    }
    scheme.addEventListener('change', post);
    return () => scheme.removeEventListener('change', post);
  }, [post]);

  const loaded = (): void => {
    loadsRef.current += 1;
    if (loadsRef.current === 1) {
      post();
      reportLoaded();
      return;
    }
    setNavigatedAway(true);
  };

  if (navigatedAway) {
    return (
      <p className="text-ink-muted" role="status">
        The report tried to open another page inside its frame, so it was
        closed. Hide the report and show it again to reload it.
      </p>
    );
  }

  if (!framePolicyAdded) {
    return null;
  }

  const roomy = room !== undefined;
  const shownWide = roomy && wide;
  return (
    <div
      className={['relative overflow-clip', roomy ? roomyBoxClass : ''].join(
        ' ',
      )}
      ref={boxRef}
      // biome-ignore lint/nursery/noInlineStyles: The room is worked out from the column, the screen and its pixel ratio, known only at run time.
      style={roomy ? ({ '--report-room': `${room}px` } as CSSProperties) : {}}
    >
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onLoad is the frame's own load event, not something a person does, so it needs no keyboard equivalent. */}
      <iframe
        className="block w-full border border-border bg-surface transition-[height] duration-300 ease-standard motion-reduce:transition-none"
        onLoad={loaded}
        ref={frameRef}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        // biome-ignore lint/nursery/noInlineStyles: The height is the one the report asked for, clamped, and known only at run time.
        style={{ height: height + frameBorderHeight }}
        title="Day report"
      />
      {roomy ? (
        <>
          <div
            aria-hidden={true}
            className={`${leftCoverClass} ${shownWide ? '-translate-x-full' : ''}`}
          />
          <div
            aria-hidden={true}
            className={`${rightCoverClass} ${shownWide ? 'translate-x-full' : ''}`}
          />
        </>
      ) : null}
    </div>
  );
};
