/**
 * Which file a day lands in, and what that file is called.
 *
 * The week is the part worth testing hard. A week that crosses New Year belongs
 * to one year and has to be counted once, and getting it wrong is not a wrong
 * label but a day filed under a week that does not exist. The cases below are
 * the ones ISO 8601 exists to settle: the last days of a December that belong
 * to the next year's first week, and the first days of a January that belong to
 * the last year's final one.
 */

import { describe, expect, it } from 'bun:test';

import {
  isoWeekKey,
  periodKeyOf,
  periodLabel,
  periodPath,
  periodsOf,
} from './export-period.ts';

const days = (...dates: ReadonlyArray<string>) =>
  dates.map((date) => ({ date }));

describe('isoWeekKey', () => {
  it('numbers a week by the year its Thursday falls in', () => {
    expect(isoWeekKey('2026-08-26')).toBe('2026-W35');
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
  });

  it('files the end of a December under the next year when the week does', () => {
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
  });

  it('files the start of a January under the last year when the week does', () => {
    expect(isoWeekKey('2027-01-03')).toBe('2026-W53');
    expect(isoWeekKey('2023-01-01')).toBe('2022-W52');
  });

  it('ends a week on the Sunday before the next one begins', () => {
    expect(isoWeekKey('2025-12-28')).toBe('2025-W52');
    expect(isoWeekKey('2026-12-31')).toBe('2026-W53');
  });

  it('pads a week number so the names sort as text', () => {
    expect(isoWeekKey('2026-03-02')).toBe('2026-W10');
    expect(isoWeekKey('2026-02-23')).toBe('2026-W09');
  });
});

describe('periodKeyOf', () => {
  it('cuts a day, a month and a year straight out of the date', () => {
    expect(periodKeyOf('day', '2026-08-26')).toBe('2026-08-26');
    expect(periodKeyOf('month', '2026-08-26')).toBe('2026-08');
    expect(periodKeyOf('year', '2026-08-26')).toBe('2026');
  });
});

describe('periodPath', () => {
  it('folders every period under its year', () => {
    expect(periodPath('day', '2026-08-26')).toBe('2026/2026-08-26.md');
    expect(periodPath('week', '2026-W35')).toBe('2026/2026-W35.md');
    expect(periodPath('month', '2026-08')).toBe('2026/2026-08.md');
  });

  it('leaves a year of days at the top rather than alone in a folder', () => {
    expect(periodPath('year', '2026')).toBe('2026.md');
  });
});

describe('periodLabel', () => {
  it('names a period the way it would be said out loud', () => {
    expect(periodLabel('week', '2026-W35')).toBe('Week 35, 2026');
    expect(periodLabel('month', '2026-08')).toBe('August 2026');
    expect(periodLabel('year', '2026')).toBe('2026');
  });
});

describe('periodsOf', () => {
  it('gathers the days of one period and starts a new one at its edge', () => {
    const periods = periodsOf(
      days('2026-01-30', '2026-01-31', '2026-02-01'),
      'month',
    );

    expect(periods.map((period) => period.key)).toEqual(['2026-01', '2026-02']);
    expect(periods[0]?.days.map((day) => day.date)).toEqual([
      '2026-01-30',
      '2026-01-31',
    ]);
  });

  /*
   * The week that straddles New Year is one period, not two, which is the whole
   * reason the key is not simply the year the date is written in.
   */
  it('keeps a week that crosses a year in one file', () => {
    const periods = periodsOf(days('2025-12-31', '2026-01-01'), 'week');

    expect(periods.map((period) => period.key)).toEqual(['2026-W01']);
  });

  it('leaves an empty journal with nothing to write', () => {
    expect(periodsOf([], 'month')).toEqual([]);
  });
});
