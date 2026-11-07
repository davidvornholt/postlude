/**
 * The patterns Insights reads out of a range. The cases worth pinning are the
 * ones that would mislead quietly: a day still to come counted as unwritten, a
 * weekday favoured because the range happens to hold one more of it, screen
 * time averaged across two ways of measuring, and the month grid's arrow keys
 * at the edges of a year.
 */

import { describe, expect, it } from 'bun:test';

import { measuresOf } from './day-measures.ts';
import {
  energyScreenTime,
  monthAfterKey,
  monthGrid,
  mostWrittenWeekday,
  scriptureBookCounts,
  scriptureMornings,
  type WeekdayPattern,
  weekdayPatterns,
  writingSummary,
} from './insights-patterns.ts';
import type { InsightsDay } from './insights-view.ts';
import type { Energy } from './schemas/day-rating.ts';
import { sampleDayMetrics } from './testing/evening-view.ts';
import { unratedDay } from './testing/insights-view.ts';

const day = (
  date: string,
  changes: Partial<InsightsDay> = {},
): InsightsDay => ({
  ...unratedDay(date),
  ...changes,
});

type Screen = {
  readonly version: number;
  readonly active: number;
  readonly focus?: number;
};

const screenDay = (
  date: string,
  energy: Energy,
  { version, active, focus }: Screen,
): InsightsDay =>
  day(date, {
    energy,
    metrics: measuresOf({
      ...sampleDayMetrics(date),
      metricsVersion: version,
      activeMinutes: active,
      focusMinutes: focus ?? null,
    }),
  });

/* 2026-10-26 is a Monday. */
const today = '2026-10-28';
const short = 100;
const long = 300;
const notes = 40;

describe('writingSummary', () => {
  it('counts the days up to today and leaves the rest of the range out', () => {
    const days = [
      day('2026-10-26', { journalWords: short }),
      day('2026-10-27'),
      day('2026-10-28', { scriptureWords: notes }),
      day('2026-10-29', { journalWords: long }),
    ];
    expect(writingSummary(days, today)).toEqual({
      elapsed: 3,
      written: 2,
      words: short + notes,
    });
  });
});

describe('weekdayPatterns', () => {
  const days = [
    day('2026-10-05', { journalWords: short, energy: 'fresh' }),
    day('2026-10-12', { journalWords: long, energy: 'drained' }),
    day('2026-10-19', { journalWords: long }),
    day('2026-10-26', { energy: 'fresh' }),
    day('2026-10-27', { journalWords: short }),
  ];
  const patterns = weekdayPatterns(days, today);

  it('gives a row to every weekday, Monday first', () => {
    expect(patterns.map((pattern) => pattern.weekday)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it('reads a weekday by its middle written day and its rated days', () => {
    expect(patterns[0]).toEqual({
      weekday: 0,
      elapsed: 4,
      written: 3,
      typicalWords: long,
      rated: 3,
      fresh: 2,
    });
    expect(patterns[2]).toMatchObject({ elapsed: 0, typicalWords: undefined });
  });

  it('takes the midpoint of the two middle days when the count is even', () => {
    const even = weekdayPatterns(
      [
        day('2026-10-19', { journalWords: short }),
        day('2026-10-26', { journalWords: long }),
      ],
      today,
    );
    expect(even[0]?.typicalWords).toBe((short + long) / 2);
  });
});

describe('mostWrittenWeekday', () => {
  const pattern = (
    weekday: number,
    written: number,
    elapsed: number,
  ): WeekdayPattern => ({
    weekday,
    elapsed,
    written,
    typicalWords: undefined,
    rated: 0,
    fresh: 0,
  });

  /* Four Mondays out of five lose to three Sundays out of three. */
  it('compares weekdays by share, not by count', () => {
    expect(mostWrittenWeekday([pattern(0, 4, 5), pattern(6, 3, 3)])).toBe(6);
  });

  it('names no weekday when they were written alike or not at all', () => {
    expect(
      mostWrittenWeekday([pattern(0, 2, 4), pattern(1, 2, 4)]),
    ).toBeUndefined();
    expect(
      mostWrittenWeekday([pattern(0, 0, 4), pattern(1, 0, 4)]),
    ).toBeUndefined();
  });
});

describe('energyScreenTime', () => {
  const oldVersion = 1;
  const newVersion = 2;

  it('averages each energy over the days measured the newest way', () => {
    const rows = energyScreenTime([
      screenDay('2026-10-01', 'fresh', {
        version: newVersion,
        active: 200,
        focus: 120,
      }),
      screenDay('2026-10-02', 'fresh', { version: newVersion, active: 300 }),
      screenDay('2026-10-03', 'drained', {
        version: newVersion,
        active: 500,
        focus: 100,
      }),
      screenDay('2026-10-04', 'drained', {
        version: oldVersion,
        active: 1000,
        focus: 900,
      }),
    ]);
    expect(rows).toEqual([
      { energy: 'drained', days: 1, activeMinutes: 500, focusMinutes: 100 },
      { energy: 'fresh', days: 2, activeMinutes: 250, focusMinutes: 120 },
    ]);
  });

  it('leaves out an energy with no measured day rather than showing zero', () => {
    const rows = energyScreenTime([
      screenDay('2026-10-01', 'okay', { version: newVersion, active: 200 }),
      day('2026-10-02', { energy: 'fresh' }),
    ]);
    expect(rows.map((row) => row.energy)).toEqual(['okay']);
  });
});

describe('scripture', () => {
  const passage = (date: string, book: string, scriptureWords = 0) =>
    day(date, { hasScripture: true, scriptureBook: book, scriptureWords });
  const days = [
    passage('2026-10-20', 'John'),
    passage('2026-10-21', 'Psalms', notes),
    passage('2026-10-22', 'John'),
    passage('2026-10-23', 'Genesis'),
    day('2026-10-24', { scriptureWords: notes }),
    day('2026-10-25', { hasScripture: true }),
    passage('2026-10-29', 'Romans'),
  ];

  it('counts a morning with a passage or topic, notes or both, up to today', () => {
    expect(scriptureMornings(days, today)).toBe(6);
  });

  it('lists the books by mornings, then in the order of the bible', () => {
    expect(scriptureBookCounts(days, today)).toEqual([
      { book: 'John', mornings: 2 },
      { book: 'Genesis', mornings: 1 },
      { book: 'Psalms', mornings: 1 },
    ]);
  });
});

describe('monthGrid', () => {
  const days = [
    day('2024-11-30', { journalWords: short, energy: 'drained' }),
    day('2024-12-01'),
    day('2026-01-15', { journalWords: long, energy: 'fresh' }),
    day('2026-01-16', { energy: 'okay', progress: 'a_lot' }),
    day('2026-10-28', { journalWords: short }),
    day('2026-10-29', { journalWords: long }),
  ];
  const years = monthGrid(days, today);

  it('puts the newest year first and leaves a gap for a missing month', () => {
    expect(years.map((year) => year.year)).toEqual([2026, 2024]);
    expect(years[0]?.months.map((summary) => summary?.month)).toEqual([
      '2026-01',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-10',
      undefined,
      undefined,
    ]);
  });

  it('sums a month over its days up to today', () => {
    expect(years[0]?.months[9]).toMatchObject({
      elapsed: 1,
      written: 1,
      words: short,
    });
  });

  it('tallies the answers and averages them from one at the low end', () => {
    const january = years[0]?.months[0];
    expect(january?.energy).toEqual({
      counts: { drained: 0, okay: 1, fresh: 1 },
      rated: 2,
      average: 2.5,
    });
    expect(january?.progress.average).toBe(3);
    expect(years[1]?.months[11]?.energy.average).toBeUndefined();
  });

  describe('monthAfterKey', () => {
    const move = (month: string, key: string) =>
      monthAfterKey(years, month, key)?.month;

    it('runs left and right through time, across the turn of a year', () => {
      expect(move('2024-12', 'ArrowRight')).toBe('2026-01');
      expect(move('2026-01', 'ArrowLeft')).toBe('2024-12');
      expect(move('2026-01', 'ArrowRight')).toBe('2026-10');
      expect(move('2026-10', 'ArrowRight')).toBeUndefined();
      expect(move('2024-11', 'ArrowLeft')).toBeUndefined();
    });

    it('keeps the month on up and down, and stops where no year holds it', () => {
      const grid = monthGrid(
        [
          day('2024-03-01'),
          day('2025-02-01'),
          day('2025-03-01'),
          day('2026-03-01'),
        ],
        today,
      );
      const vertical = (month: string, key: string) =>
        monthAfterKey(grid, month, key)?.month;
      expect(vertical('2026-03', 'ArrowDown')).toBe('2025-03');
      expect(vertical('2024-03', 'ArrowUp')).toBe('2025-03');
      expect(vertical('2025-02', 'ArrowUp')).toBeUndefined();
      expect(vertical('2025-02', 'ArrowDown')).toBeUndefined();
    });

    it('skips a year that does not hold the month', () => {
      const grid = monthGrid(
        [day('2024-03-01'), day('2025-02-01'), day('2026-03-01')],
        today,
      );
      expect(monthAfterKey(grid, '2026-03', 'ArrowDown')?.month).toBe(
        '2024-03',
      );
    });

    it('leaves every other key to the browser', () => {
      expect(move('2026-01', 'Enter')).toBeUndefined();
      expect(move('2025-06', 'ArrowRight')).toBeUndefined();
    });
  });
});
