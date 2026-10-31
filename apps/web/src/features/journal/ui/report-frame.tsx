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
 * frame's own window, and only within bounds.
 *
 * A report that navigates its frame anyway has stopped being the report, so
 * the frame is taken down when it loads again and nothing more is sent to it.
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

const pageTheme = (): ReportTheme =>
  globalThis.matchMedia?.(darkScheme).matches === true ? 'dark' : 'light';

export const ReportFrame = ({
  reportHtml,
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
      className="block w-full border border-border bg-surface"
      onLoad={loaded}
      ref={frameRef}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      // biome-ignore lint/nursery/noInlineStyles: The height is the one the report asked for, clamped, and known only at run time.
      style={{ height }}
      title="Day report"
    />
  );
};
