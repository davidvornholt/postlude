import { describe, expect, it } from 'bun:test';

import {
  calendarWeekdayIndex,
  datesInMonth,
  firstDateOfMonth,
  isJournalMonth,
  journalMonthLabel,
  shiftJournalMonth,
} from './calendar.ts';

const sundayColumn = 6;
const decemberDayCount = 31;

describe('journal calendar months', () => {
  it('validates and names supported months', () => {
    expect(isJournalMonth('2026-08')).toBe(true);
    expect(isJournalMonth('2026-13')).toBe(false);
    expect(isJournalMonth('26-08')).toBe(false);
    expect(journalMonthLabel('2026-08')).toBe('August 2026');
  });

  it('moves between years without leaving the supported calendar', () => {
    expect(shiftJournalMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftJournalMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftJournalMonth('0001-01', -1)).toBeUndefined();
    expect(shiftJournalMonth('9999-12', 1)).toBeUndefined();
  });

  it('lists leap days and places Monday in the first column', () => {
    const dates = datesInMonth('2024-02');
    expect(firstDateOfMonth('2024-02')).toBe('2024-02-01');
    expect(dates.at(-1)).toBe('2024-02-29');
    expect(calendarWeekdayIndex('2026-08-24')).toBe(0);
    expect(calendarWeekdayIndex('2026-08-30')).toBe(sundayColumn);
  });

  it('lists the final supported month without stepping past its last day', () => {
    const dates = datesInMonth('9999-12');

    expect(dates).toHaveLength(decemberDayCount);
    expect(dates.at(-1)).toBe('9999-12-31');
  });
});
