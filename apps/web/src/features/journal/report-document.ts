/**
 * What the report frame is given, and what it may send back.
 *
 * /wrap writes the report as a whole page and Postlude shows it in a sandboxed
 * frame without `allow-same-origin`, so the report runs in an opaque origin of
 * its own. The policy below goes in front of every report, whether or not it
 * carries one already: a page that sets its own policy is still held to this
 * one, because a browser enforces every policy a document has.
 *
 * The page never carries numbers. They reach it after it has loaded, in one
 * message, and it fills them in itself.
 */

import type { DayMetrics } from './schemas/day-metrics.ts';

export const reportContentSecurityPolicy =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";

/**
 * The report as the frame's `srcdoc`, behind a doctype and the policy. None of
 * the report's own markup goes before them, so no part of it is parsed before
 * the policy is in force. The doctype puts the page in standards mode, and the
 * parser ignores any doctype the report has of its own. The meta element opens
 * `<html>` and `<head>` implicitly, and the report's own `<html>` and `<head>`
 * tags then join them rather than starting new ones, so the policy lands in
 * the head where a browser reads it.
 */
export const reportDocumentOf = (reportHtml: string): string =>
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="${reportContentSecurityPolicy}">${reportHtml}`;

export type ReportTheme = 'light' | 'dark';

/** The one message the report fills its numbers from. */
export type DayMetricsMessage = {
  readonly type: 'postlude:day-metrics';
  readonly metricsVersion: number;
  readonly dayMetrics: DayMetrics;
  readonly theme: ReportTheme;
};

export const dayMetricsMessageOf = (
  dayMetrics: DayMetrics,
  metricsVersion: number,
  theme: ReportTheme,
): DayMetricsMessage => ({
  type: 'postlude:day-metrics',
  metricsVersion,
  dayMetrics,
  theme,
});

/**
 * The frame's height before the report has said how tall it is, and the range
 * it may ask for. A report can't make the frame vanish, and can't make the page
 * so tall that nothing after it can be reached.
 */
export const reportHeightBounds = {
  initial: 480,
  minimum: 160,
  maximum: 12_000,
} as const;

/**
 * The height a `postlude:report-height` message asks for, kept within the
 * bounds, or undefined when the message is anything else. Checking where it
 * came from is the caller's job: only the frame's own window may resize it.
 */
export const reportHeightOf = (data: unknown): number | undefined => {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('type' in data) ||
    data.type !== 'postlude:report-height' ||
    !('height' in data) ||
    typeof data.height !== 'number' ||
    !Number.isFinite(data.height)
  ) {
    return;
  }
  return Math.min(
    reportHeightBounds.maximum,
    Math.max(reportHeightBounds.minimum, Math.ceil(data.height)),
  );
};
