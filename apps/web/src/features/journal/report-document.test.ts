import { describe, expect, it } from 'bun:test';

import {
  dayMetricsMessageOf,
  reportContentSecurityPolicy,
  reportDocumentOf,
  reportHeightBounds,
  reportHeightOf,
} from './report-document.ts';
import type { DayMetrics } from './schemas/day-metrics.ts';

const policy = `<meta http-equiv="Content-Security-Policy" content="${reportContentSecurityPolicy}">`;

describe('reportDocumentOf', () => {
  it('carries the contract policy exactly', () => {
    expect(reportContentSecurityPolicy).toBe(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:",
    );
  });

  it('puts the policy right after the doctype, so the page stays in standards mode', () => {
    expect(
      reportDocumentOf('<!doctype html><html lang="en"><head></head></html>'),
    ).toBe(`<!doctype html>${policy}<html lang="en"><head></head></html>`);
  });

  it('finds the doctype in any case and after leading comments', () => {
    expect(
      reportDocumentOf('\n<!-- made by /wrap -->\n<!DOCTYPE html>\n<p>'),
    ).toBe(`\n<!-- made by /wrap -->\n<!DOCTYPE html>${policy}\n<p>`);
  });

  it('puts the policy first when there is no doctype', () => {
    expect(reportDocumentOf('<p>A fragment</p>')).toBe(
      `${policy}<p>A fragment</p>`,
    );
  });

  it('keeps a policy the report sets itself, since both are enforced', () => {
    const own =
      '<!doctype html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head>';
    const document = reportDocumentOf(own);
    expect(document.startsWith(`<!doctype html>${policy}`)).toBe(true);
    expect(document.endsWith(own.slice('<!doctype html>'.length))).toBe(true);
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
