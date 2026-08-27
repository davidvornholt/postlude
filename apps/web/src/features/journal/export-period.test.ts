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
} from './export-period.ts';

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

  it('keeps Common Era years below 0100 on their Gregorian weeks', () => {
    expect(isoWeekKey('0001-01-01')).toBe('0001-W01');
    expect(isoWeekKey('0099-01-01')).toBe('0099-W01');
    expect(isoWeekKey('0099-12-31')).toBe('0099-W53');
    expect(isoWeekKey('0100-01-01')).toBe('0099-W53');
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

  it('keeps early years distinct and zero-padded', () => {
    expect(periodPath('day', '0001-08-26')).toBe('0001/0001-08-26.md');
    expect(periodPath('week', '0099-W01')).toBe('0099/0099-W01.md');
    expect(periodPath('month', '0100-08')).toBe('0100/0100-08.md');
  });

  it('accepts week 53 only in ISO years that contain it', () => {
    expect(periodPath('week', '0001-W52')).toBe('weeks/0001/0001-W52.md');
    expect(() => periodPath('week', '0001-W53')).toThrow();
    expect(periodPath('week', '0099-W53')).toBe('weeks/0099/0099-W53.md');
    expect(periodPath('week', '2026-W53')).toBe('weeks/2026/2026-W53.md');
    expect(() => periodPath('week', '2025-W53')).toThrow();
  });

  it('checks the last supported year without Date year coercion', () => {
    expect(periodPath('week', '9999-W52')).toBe('weeks/9999/9999-W52.md');
    expect(() => periodPath('week', '9999-W53')).toThrow();
  });

  it('rejects a key from a different grouping before it can collide', () => {
    expect(() => periodPath('day', '2026-W35')).toThrow();
    expect(() => periodPath('week', '2026-08')).toThrow();
    expect(() => periodPath('month', '2026-W35')).toThrow();
    expect(() => periodPath('year', '2026-08')).toThrow();
  });
});

describe('periodLabel', () => {
  it('names a period the way it would be said out loud', () => {
    expect(periodLabel('week', '2026-W35')).toBe('Week 35, 2026');
    expect(periodLabel('month', '2026-08')).toBe('August 2026');
    expect(periodLabel('year', '2026')).toBe('2026');
  });

  it('names early years without dropping their leading zeroes', () => {
    expect(periodLabel('week', '0099-W01')).toBe('Week 1, 0099');
    expect(periodLabel('month', '0100-08')).toBe('August 0100');
  });
});
