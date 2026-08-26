/**
 * The label has one job the type system cannot state: it has to name the day
 * the page is for, not a day either side of it. A date formatted as an instant
 * slips by one for every reader west of UTC, and it slips silently — the page
 * still renders, with yesterday's date on today's writing.
 */

import { expect, it } from 'bun:test';

import { journalDateLabel, journalDayRelation } from './day-label.ts';

it('names the day the date is, spelled out', () => {
  expect(journalDateLabel('2026-08-26')).toBe('Wednesday 26 August 2026');
});

it('does not slip a day at either end of the year', () => {
  expect(journalDateLabel('2026-01-01')).toBe('Thursday 1 January 2026');
  expect(journalDateLabel('2025-12-31')).toBe('Wednesday 31 December 2025');
});

it('keeps the leap day a day', () => {
  expect(journalDateLabel('2024-02-29')).toBe('Thursday 29 February 2024');
});

it('does not let JavaScript rewrite years below 0100', () => {
  expect(journalDateLabel('0001-01-01')).toBe('Monday 1 January 1');
  expect(journalDateLabel('0099-01-01')).toBe('Thursday 1 January 99');
  expect(journalDateLabel('0100-01-01')).toBe('Friday 1 January 100');
});

it('names today and yesterday rather than counting them', () => {
  expect(journalDayRelation('2026-08-26', '2026-08-26')).toBe('Today');
  expect(journalDayRelation('2026-08-25', '2026-08-26')).toBe('Yesterday');
});

it('counts the days back for everything older', () => {
  expect(journalDayRelation('2026-08-24', '2026-08-26')).toBe('2 days ago');
  expect(journalDayRelation('2025-08-26', '2026-08-26')).toBe('365 days ago');
});

/*
 * Months and years are where a naive difference goes wrong, because the gap
 * between two dates is not the gap between their day numbers.
 */
it('counts across a month and a leap year', () => {
  expect(journalDayRelation('2026-07-31', '2026-08-01')).toBe('Yesterday');
  expect(journalDayRelation('2024-02-28', '2024-03-01')).toBe('2 days ago');
});
