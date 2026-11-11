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
 * The frame sits in the text column, and where the screen is wide enough it
 * can be shown wide, because the report's timeline can use more width than the
 * column has. /wrap's template keeps the report's text in a column 720px wide
 * at the middle of its page, so the wide frame's middle sits 360px right of
 * the text column's edge, and the report's text then starts exactly where the
 * page's does. The frame grows to the template's widest page, 1480px and its
 * border, but no closer to the screen's left edge than the page's own margin.
 *
 * Widening moves one number, `--report-wide`, from 0 to 1, and the width and
 * the margin are worked out from it, so every step of the way is a frame the
 * report can lay out. Narrower than the template's text column and its 20px
 * padding, the report's text starts 21px into the frame, so the margin then
 * moves only the 21px that brings the text to the page's edge; wider, the
 * margin keeps the frame's middle where the text ends up. The text slides
 * steadily in one direction while the frame opens around it. The report
 * reflows as it goes and asks for its new height, which the frame eases to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  dayMetricsMessageOf,
  type ReportTheme,
  reportDocumentOf,
  reportHeightBounds,
  reportHeightOf,
} from '../report-document.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';

type ReportFrameProps = {
  readonly reportHtml: string;
  /** Wide where the screen is wide enough, and in the text column elsewhere. */
  readonly wide: boolean;
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
 * The frame's width and margin, worked out from `--report-wide` as the comment
 * at the top describes. A percentage is the text column's width, both in the
 * width and in the margin. The wide width is the screen less the page's frame
 * (56rem), with the report's text column (720px) added back, which leaves the
 * page's margin at the left.
 */
const frameGeometryClass = [
  '[--report-width:calc(100%_+_var(--report-wide)_*_(min(1482px,100vw_-_56rem_+_720px)_-_100%))]',
  'w-(--report-width)',
  'ml-[calc(min(0px,381px_-_var(--report-width)_/_2)_-_21px_*_var(--report-wide))]',
].join(' ');

/**
 * The frame's border above and below the report, 1px each, which the frame's
 * height includes. Added to the height the report asked for, it leaves the
 * report all of that height, so it never has a pixel to scroll.
 */
const frameBorderHeight = 2;

/** Wide from the width at which the wide frame gains the report real room. */
const wideClass = 'lg:[--report-wide:1]';

const pageTheme = (): ReportTheme =>
  globalThis.matchMedia?.(darkScheme).matches === true ? 'dark' : 'light';

export const ReportFrame = ({
  reportHtml,
  wide,
  dayMetrics,
  metricsVersion,
}: ReportFrameProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadsRef = useRef(0);
  const [height, setHeight] = useState<number>(reportHeightBounds.initial);
  const [navigatedAway, setNavigatedAway] = useState(false);
  const [framePolicyAdded, setFramePolicyAdded] = useState(false);
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
      const own = frameRef.current?.contentWindow;
      if (own === null || own === undefined || event.source !== own) {
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

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onLoad is the frame's own load event, not something a person does, so it needs no keyboard equivalent.
    <iframe
      className={[
        'block border border-border bg-surface transition-[height,--report-wide] ease-standard [transition-duration:300ms,400ms] motion-reduce:transition-none',
        frameGeometryClass,
        wide ? wideClass : '',
      ].join(' ')}
      onLoad={loaded}
      ref={frameRef}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      // biome-ignore lint/nursery/noInlineStyles: The height is the one the report asked for, clamped, and known only at run time.
      style={{ height: height + frameBorderHeight }}
      title="Day report"
    />
  );
};
