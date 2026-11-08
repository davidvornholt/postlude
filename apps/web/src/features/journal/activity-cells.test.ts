import { expect, it } from 'bun:test';

import {
  type ActivitySource,
  activityCells,
  activityWeeks,
} from './activity-cells.ts';
import { daysBetweenJournalDates } from './journal-day.ts';
import type { Energy, Progress } from './schemas/day-rating.ts';

const day = (
  date: string,
  journalWords: number,
  energy: Energy | null = null,
  progress: Progress | null = null,
): ActivitySource => ({
  date,
  journalWords,
  scriptureWords: 0,
  energy,
  progress,
});

const daysPerWeek = 7;
const today = '2026-08-26';
const year2025 = { from: '2025-01-01', to: '2025-12-31' } as const;
const year2026 = { from: '2026-01-01', to: '2026-12-31' } as const;
const mostWords = 400;
/* 2025 opens on a Wednesday, so its first Monday-to-Sunday week has five days. */
const firstWeekDays2025 = 5;

it('draws a square for every day of the stretch, written or not', () => {
  const cells = activityCells([day('2025-06-01', mostWords)], year2025, today);

  expect(cells.length).toBe(
    daysBetweenJournalDates(year2025.from, year2025.to) + 1,
  );
  expect(
    cells.filter((cell) => cell.kind === 'day' && cell.shade !== 'none').length,
  ).toBe(1);
});

it('leaves days outside the stretch off the grid', () => {
  const cells = activityCells([day('2023-06-01', mostWords)], year2025, today);

  expect(cells.every((cell) => cell.kind === 'day' && cell.words === 0)).toBe(
    true,
  );
});

it('keeps the rest of the current year as future padding', () => {
  const cells = activityCells([day('2026-08-27', mostWords)], year2026, today);
  const future = cells.filter((cell) => cell.kind === 'future-padding');

  expect(future[0]).toEqual({ kind: 'future-padding', date: '2026-08-27' });
  expect(future.at(-1)?.date).toBe('2026-12-31');
  expect(future.every((cell) => cell.date > today)).toBe(true);
});

/*
 * The weeks run Monday to Sunday, as the calendar's rows do, so a year that
 * opens mid-week opens on a short column rather than on days of the year before.
 */
it('clips the first week to the stretch and keeps the rest whole', () => {
  const weeks = activityWeeks(activityCells([], year2025, today));

  expect(weeks[0]?.[0]?.date).toBe('2025-01-01');
  expect(weeks[0]).toHaveLength(firstWeekDays2025);
  expect(weeks[1]?.[0]?.date).toBe('2025-01-06');
  expect(weeks.slice(1, -1).every((week) => week.length === daysPerWeek)).toBe(
    true,
  );
  expect(weeks.at(-1)?.at(-1)?.date).toBe('2025-12-31');
});

/*
 * Energy and progress share one scale: the low answer takes the low step, the
 * middle the middle and the hoped-for answer the high one. A day without an
 * answer takes none.
 */
it('colours a day by its energy or progress when asked to', () => {
  const stretch = { from: '2025-03-03', to: '2025-03-06' } as const;
  const days = [
    day('2025-03-03', mostWords, 'drained', 'little'),
    day('2025-03-04', mostWords, 'okay', 'solid'),
    day('2025-03-05', mostWords, 'fresh', 'a_lot'),
    day('2025-03-06', mostWords),
  ];
  const shades = (measure: 'energy' | 'progress') =>
    activityCells(days, stretch, today, measure).map((cell) =>
      cell.kind === 'day' ? cell.shade : undefined,
    );

  expect(shades('energy')).toEqual(['low', 'middle', 'high', 'none']);
  expect(shades('progress')).toEqual(['low', 'middle', 'high', 'none']);
});
