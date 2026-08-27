import { expect, it } from 'bun:test';

import type { ActivityDay } from './activity.ts';
import { activityWindow } from './activity.ts';
import { activityCells, activityWeeks } from './activity-cells.ts';
import { daysBetweenJournalDates } from './journal-day.ts';
import { lastArchiveYear } from './schemas/archive-query.ts';

const day = (date: string, journalWords: number): ActivityDay => ({
  date,
  journalWords,
  scriptureWords: 0,
  hasScripture: false,
  journalWrittenOnTheDay: true,
  scriptureUsedOnTheDay: true,
});

const daysPerWeek = 7;
const firstClippedWeekDays = 6;
const rollingWeeksShown = 53;
const today = '2026-08-26';
const namedYear = 2025;
const currentNamedYear = 2026;
const mostWords = 400;

it('keeps the first supported year inside the journal date range', () => {
  const window = activityWindow(today, 1);
  const weeks = activityWeeks(activityCells([], window, today));

  expect(window).toEqual({ from: '0001-01-01', to: '0002-01-05' });
  expect(weeks[0]?.[0]?.date).toBe('0001-01-01');
  expect(weeks[0]).toHaveLength(firstClippedWeekDays);
  expect(weeks.slice(1).every((week) => week.length === daysPerWeek)).toBe(
    true,
  );
});

it('draws the maximum named year as 53 complete four-digit weeks', () => {
  const window = activityWindow(today, lastArchiveYear);
  const weeks = activityWeeks(activityCells([], window, today));

  expect(window).toEqual({ from: '9997-12-28', to: '9999-01-02' });
  expect(weeks).toHaveLength(rollingWeeksShown);
  expect(weeks.every((week) => week.length === daysPerWeek)).toBe(true);
});

it('draws a square for every day of the window, written or not', () => {
  const window = activityWindow(today, namedYear);
  const cells = activityCells([day('2025-06-01', mostWords)], window, today);

  expect(cells.length).toBe(
    daysBetweenJournalDates(window.from, window.to) + 1,
  );
  expect(
    cells.filter((cell) => cell.kind === 'day' && cell.level !== 'none').length,
  ).toBe(1);
});

it('leaves days outside the window off the grid', () => {
  const window = activityWindow(today, namedYear);
  const cells = activityCells([day('2023-06-01', mostWords)], window, today);

  expect(cells.every((cell) => cell.kind === 'day' && cell.words === 0)).toBe(
    true,
  );
});

it('lays the squares out as columns of a week each', () => {
  const weeks = activityWeeks(activityCells([], activityWindow(today), today));

  expect(weeks.every((week) => week.length === daysPerWeek)).toBe(true);
});

it('keeps the rest of the rolling week as future padding', () => {
  const firstFutureDate = '2026-08-27';
  const cells = activityCells(
    [day(firstFutureDate, mostWords)],
    activityWindow(today),
    today,
  );
  const future = cells.filter((cell) => cell.kind === 'future-padding');

  expect(future.map((cell) => cell.date)).toEqual([
    firstFutureDate,
    '2026-08-28',
    '2026-08-29',
  ]);
  expect(future[0]).toEqual({ kind: 'future-padding', date: firstFutureDate });
});

it('keeps the rest of the current named year as future padding', () => {
  const cells = activityCells(
    [],
    activityWindow(today, currentNamedYear),
    today,
  );
  const future = cells.filter((cell) => cell.kind === 'future-padding');

  expect(future[0]?.date).toBe('2026-08-27');
  expect(future.at(-1)?.date).toBe('2027-01-02');
  expect(future.every((cell) => cell.date > today)).toBe(true);
});
