import { describe, expect, it } from 'bun:test';

import {
  daysBetweenJournalDates,
  isJournalDate,
  journalDateAt,
  journalDateWeekday,
  shiftJournalDate,
} from './journal-day.ts';

const berlin = 'Europe/Berlin';
const monday = 1;
const thursday = 4;
const friday = 5;

/** An instant written as the UTC clock, which is the one clock with no rules. */
const utc = (text: string): Date => new Date(`${text}Z`);

describe('journalDateAt', () => {
  it('keeps the small hours with the evening they close out', () => {
    // 01:30 and 03:59 Berlin on the 27th are still the 26th's journal day; the
    // writer has not been to bed.
    expect(journalDateAt(utc('2026-08-27T00:30:00'), berlin)).toBe(
      '2026-08-26',
    );
    expect(journalDateAt(utc('2026-08-27T01:59:00'), berlin)).toBe(
      '2026-08-26',
    );
  });

  it('opens the new journal day at 04:00 exactly', () => {
    // 03:59:59 and 04:00:00 Berlin, one second apart across the boundary.
    expect(journalDateAt(utc('2026-08-27T01:59:59'), berlin)).toBe(
      '2026-08-26',
    );
    expect(journalDateAt(utc('2026-08-27T02:00:00'), berlin)).toBe(
      '2026-08-27',
    );
  });

  it('reads the zone rather than the machine the code runs on', () => {
    // 23:30 UTC is already the next day in Berlin, and the evening before in
    // New York. Same instant, three answers, and the machine's own zone is not
    // one of them.
    const instant = utc('2026-08-26T23:30:00');
    expect(journalDateAt(instant, berlin)).toBe('2026-08-26');
    expect(journalDateAt(instant, 'America/New_York')).toBe('2026-08-26');
    expect(journalDateAt(instant, 'Pacific/Auckland')).toBe('2026-08-27');
  });

  /*
   * The two days a year the offset moves. Shifting the instant back four hours
   * and taking the date would be wrong on both of them, because the offset at
   * the shifted instant is not the offset at the original one — on the spring
   * morning it would answer the 28th for a moment that is plainly the 29th.
   * These pin the boundary to the zone's own clock instead.
   */
  it('holds the boundary at 04:00 when the clocks go forward', () => {
    // Berlin springs forward 02:00 CET to 03:00 CEST on 2026-03-29, so 04:30
    // local is 02:30 UTC and 01:30 local is 00:30 UTC.
    expect(journalDateAt(utc('2026-03-29T00:30:00'), berlin)).toBe(
      '2026-03-28',
    );
    expect(journalDateAt(utc('2026-03-29T02:30:00'), berlin)).toBe(
      '2026-03-29',
    );
  });

  it('holds the boundary at 04:00 when the clocks go back', () => {
    // Berlin falls back 03:00 CEST to 02:00 CET on 2026-10-25. Local 02:30
    // happens twice — 00:30 UTC and 01:30 UTC — and both are the 24th's night.
    expect(journalDateAt(utc('2026-10-25T00:30:00'), berlin)).toBe(
      '2026-10-24',
    );
    expect(journalDateAt(utc('2026-10-25T01:30:00'), berlin)).toBe(
      '2026-10-24',
    );
    expect(journalDateAt(utc('2026-10-25T03:30:00'), berlin)).toBe(
      '2026-10-25',
    );
  });

  it('steps back over the end of a month and a year', () => {
    // 02:00 Berlin on 1 January is 01:00 UTC, and belongs to New Year's Eve.
    expect(journalDateAt(utc('2026-01-01T01:00:00'), berlin)).toBe(
      '2025-12-31',
    );
    expect(journalDateAt(utc('2026-03-01T01:00:00'), berlin)).toBe(
      '2026-02-28',
    );
    expect(journalDateAt(utc('2024-03-01T01:00:00'), berlin)).toBe(
      '2024-02-29',
    );
  });
});

describe('shiftJournalDate', () => {
  it('crosses months, years, and a leap day', () => {
    expect(shiftJournalDate('2026-08-26', 1)).toBe('2026-08-27');
    expect(shiftJournalDate('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftJournalDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftJournalDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftJournalDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftJournalDate('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('carries across more than one month in a single step', () => {
    expect(shiftJournalDate('2026-01-31', 60)).toBe('2026-04-01');
    expect(shiftJournalDate('2026-04-01', -60)).toBe('2026-01-31');
    expect(shiftJournalDate('2026-08-26', 0)).toBe('2026-08-26');
  });

  it('is undone by the opposite shift across a year of days', () => {
    const steps = 400;
    const start = '2025-11-15';
    let date = start;
    for (let step = 0; step < steps; step += 1) {
      date = shiftJournalDate(date, 1);
    }
    expect(date).toBe('2026-12-20');
    expect(shiftJournalDate(date, -steps)).toBe(start);
  });

  it('refuses to leave the supported Common Era range', () => {
    expect(() => shiftJournalDate('0001-01-01', -1)).toThrow(RangeError);
    expect(() => shiftJournalDate('9999-12-31', 1)).toThrow(RangeError);
  });
});

describe('daysBetweenJournalDates', () => {
  it('counts days in both directions', () => {
    expect(daysBetweenJournalDates('2026-08-26', '2026-08-27')).toBe(1);
    expect(daysBetweenJournalDates('2026-08-27', '2026-08-26')).toBe(-1);
    expect(daysBetweenJournalDates('2026-08-26', '2026-08-26')).toBe(0);
  });

  // The streak arithmetic asks this across the days the clocks move, where a
  // difference measured in elapsed hours would come out as 23 or 25.
  it('counts a whole day across both clock changes', () => {
    expect(daysBetweenJournalDates('2026-03-28', '2026-03-29')).toBe(1);
    expect(daysBetweenJournalDates('2026-10-24', '2026-10-25')).toBe(1);
    const daysInCommonYear = 365;
    expect(daysBetweenJournalDates('2025-12-31', '2026-12-31')).toBe(
      daysInCommonYear,
    );
  });

  it('does not let JavaScript rewrite years below 100', () => {
    expect(daysBetweenJournalDates('0099-12-31', '0100-01-01')).toBe(1);
    expect(daysBetweenJournalDates('0100-01-01', '0099-12-31')).toBe(-1);
  });
});

describe('journalDateWeekday', () => {
  it('reads early Common Era years without JavaScript adding 1900', () => {
    expect(journalDateWeekday('0001-01-01')).toBe(monday);
    expect(journalDateWeekday('0099-12-31')).toBe(thursday);
    expect(journalDateWeekday('0100-01-01')).toBe(friday);
  });
});

describe('isJournalDate', () => {
  it('accepts a calendar date and refuses anything that only looks like one', () => {
    expect(isJournalDate('2026-08-26')).toBe(true);
    expect(isJournalDate('2024-02-29')).toBe(true);
    expect(isJournalDate('2025-02-29')).toBe(false);
    expect(isJournalDate('2026-13-01')).toBe(false);
    expect(isJournalDate('2026-00-10')).toBe(false);
    expect(isJournalDate('2026-04-31')).toBe(false);
    expect(isJournalDate('2026-8-26')).toBe(false);
    expect(isJournalDate('2026-08-26T00:00:00Z')).toBe(false);
    expect(isJournalDate('')).toBe(false);
  });

  it('stays inside the supported four-digit Common Era range', () => {
    expect(isJournalDate('0001-01-01')).toBe(true);
    expect(isJournalDate('0099-12-31')).toBe(true);
    expect(isJournalDate('0100-01-01')).toBe(true);
    expect(isJournalDate('9999-12-31')).toBe(true);
    expect(isJournalDate('0000-01-01')).toBe(false);
    expect(isJournalDate('10000-01-01')).toBe(false);
  });
});
