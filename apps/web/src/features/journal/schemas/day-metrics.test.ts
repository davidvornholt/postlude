import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';

import {
  dayLogLengthLimit,
  reportHtmlByteLimit,
  WrapPutSchema,
} from './agent-area.ts';
import { type DayMetrics, DayMetricsSchema } from './day-metrics.ts';

const metrics: DayMetrics = {
  metricsVersion: 1,
  day: '2026-10-30',
  activeMinutes: 312,
  firstActivityAt: '2026-10-30T07:12:00+01:00',
  lastActivityAt: '2026-10-30T22:40:05.120Z',
  focusMinutes: 190,
  scatteredMinutes: 60,
  categories: [{ id: 'code', label: 'Code', minutes: 150 }],
  offComputerMinutes: 95,
  appointmentMinutes: 45,
  appointmentOffScreenMinutes: 30,
  landedPrs: 3,
  sentMails: [{ mailbox: 'personal', count: 2 }],
  coverage: [{ source: 'activitywatch', status: 'complete' }],
};

const decodes = (value: unknown) =>
  Schema.decodeUnknownExit(DayMetricsSchema)(value, {
    onExcessProperty: 'error',
  })._tag === 'Success';

const putDecodes = (value: unknown) =>
  Schema.decodeUnknownExit(WrapPutSchema)(value, {
    onExcessProperty: 'error',
  })._tag === 'Success';

describe('day metrics', () => {
  it('accepts a complete day', () => {
    expect(decodes(metrics)).toBe(true);
  });

  it('accepts null for every number a source could not measure', () => {
    expect(
      decodes({
        ...metrics,
        activeMinutes: null,
        firstActivityAt: null,
        lastActivityAt: null,
        focusMinutes: null,
        scatteredMinutes: null,
        categories: [{ id: 'code', label: 'Code', minutes: null }],
        offComputerMinutes: null,
        appointmentMinutes: null,
        appointmentOffScreenMinutes: null,
        landedPrs: null,
        sentMails: [{ mailbox: 'personal', count: null }],
        coverage: [{ source: 'activitywatch', status: 'unreachable' }],
      }),
    ).toBe(true);
  });

  it('accepts empty lists', () => {
    expect(
      decodes({ ...metrics, categories: [], sentMails: [], coverage: [] }),
    ).toBe(true);
  });

  it('refuses minutes that are negative or fractional', () => {
    expect(decodes({ ...metrics, activeMinutes: -1 })).toBe(false);
    expect(decodes({ ...metrics, focusMinutes: 12.5 })).toBe(false);
    expect(
      decodes({
        ...metrics,
        categories: [{ id: 'code', label: 'Code', minutes: -3 }],
      }),
    ).toBe(false);
  });

  it('refuses a missing field rather than reading it as null', () => {
    const { landedPrs: _, ...withoutPrs } = metrics;
    expect(decodes(withoutPrs)).toBe(false);
  });

  it('refuses fields it does not know', () => {
    expect(decodes({ ...metrics, keystrokes: 4000 })).toBe(false);
    expect(
      decodes({
        ...metrics,
        sentMails: [{ mailbox: 'personal', count: 1, subject: 'Hi' }],
      }),
    ).toBe(false);
  });

  it('refuses a day that is not a date', () => {
    expect(decodes({ ...metrics, day: '30.10.2026' })).toBe(false);
    expect(decodes({ ...metrics, day: '2026-02-30' })).toBe(false);
  });

  it('refuses an instant without a time zone', () => {
    expect(decodes({ ...metrics, firstActivityAt: '2026-10-30T07:12' })).toBe(
      false,
    );
    expect(decodes({ ...metrics, firstActivityAt: 'this morning' })).toBe(
      false,
    );
  });

  it('refuses a version below one', () => {
    expect(decodes({ ...metrics, metricsVersion: 0 })).toBe(false);
  });

  it('refuses empty labels and overlong lists', () => {
    expect(
      decodes({ ...metrics, categories: [{ id: '', label: 'x', minutes: 1 }] }),
    ).toBe(false);
    const many = Array.from({ length: 101 }, (_, index) => ({
      id: `c${index}`,
      label: 'x',
      minutes: 1,
    }));
    expect(decodes({ ...metrics, categories: many })).toBe(false);
  });
});

describe('agent area input', () => {
  const put = {
    dayMetrics: metrics,
    metricsVersion: 1,
    reportHtml: '<!doctype html><p>The day.</p>',
    reportModel: 'gpt-6-astra',
    dayLog: '09:10–11:45 Wrote the plan.\n\n14:00–15:30 Answered mail.',
  };

  it('accepts a report with its metrics', () => {
    expect(putDecodes(put)).toBe(true);
  });

  it('refuses a version that disagrees with the metrics', () => {
    expect(putDecodes({ ...put, metricsVersion: 2 })).toBe(false);
  });

  it('refuses an empty report or one without a model', () => {
    expect(putDecodes({ ...put, reportHtml: '  ' })).toBe(false);
    expect(putDecodes({ ...put, reportModel: '' })).toBe(false);
  });

  it('refuses a report over the size limit', () => {
    expect(
      putDecodes({ ...put, reportHtml: 'x'.repeat(reportHtmlByteLimit + 1) }),
    ).toBe(false);
  });

  it('refuses the columns only Postlude writes', () => {
    expect(putDecodes({ ...put, reportGeneratedAt: '2026-10-30' })).toBe(false);
    expect(putDecodes({ ...put, agentNote: 'Hello' })).toBe(false);
  });

  it('needs a day log', () => {
    const { dayLog: _, ...withoutLog } = put;
    expect(putDecodes(withoutLog)).toBe(false);
    expect(putDecodes({ ...put, dayLog: null })).toBe(false);
  });

  it('refuses an empty or blank day log', () => {
    expect(putDecodes({ ...put, dayLog: '' })).toBe(false);
    expect(putDecodes({ ...put, dayLog: ' \n\n\t ' })).toBe(false);
  });

  it('takes a day log up to its length limit, counted as JavaScript counts', () => {
    expect(putDecodes({ ...put, dayLog: 'x'.repeat(dayLogLengthLimit) })).toBe(
      true,
    );
    expect(
      putDecodes({ ...put, dayLog: 'x'.repeat(dayLogLengthLimit + 1) }),
    ).toBe(false);
    // An emoji is two UTF-16 code units.
    expect(
      putDecodes({ ...put, dayLog: '🙂'.repeat(dayLogLengthLimit / 2) }),
    ).toBe(true);
    expect(
      putDecodes({ ...put, dayLog: `x${'🙂'.repeat(dayLogLengthLimit / 2)}` }),
    ).toBe(false);
  });

  it('takes tabs, line feeds and markup as plain text', () => {
    expect(
      putDecodes({ ...put, dayLog: '09:10–11:45\tRead <b>the</b> & docs.' }),
    ).toBe(true);
  });

  it('refuses other control characters', () => {
    for (const control of [
      '\r',
      '\u0000',
      '\u000b',
      '\u001b',
      '\u007f',
      '\u0085',
    ]) {
      expect(putDecodes({ ...put, dayLog: `09:10–11:45 A${control}B` })).toBe(
        false,
      );
    }
  });
});
