import { expect, it } from 'bun:test';

import { activityCells, activityWeeks, activityWindow } from './activity.ts';
import {
  activityDescription,
  activitySummary,
  monthColumnLabels,
  monthYearLabel,
} from './activity-labels.ts';

const day = (date: string, journalWords: number) => ({
  date,
  journalWords,
  scriptureWords: 0,
  hasScripture: false,
  writtenOnTheDay: true,
});

const today = '2026-08-26';
const namedYear = 2025;
const longDay = 400;
const shortDay = 100;

const window2025 = activityWindow(today, namedYear);
const cells2025 = activityCells(
  [day('2025-06-01', longDay), day('2025-06-08', shortDay)],
  window2025,
);

it('names a month and its year in full', () => {
  expect(monthYearLabel('2025-06-01')).toBe('June 2025');
});

/*
 * A label is set above its own column and allowed to run past it, so a month
 * narrow enough for the next name to land on top of it is left unnamed.
 */
it('names a month only where the next name has room', () => {
  const labels = monthColumnLabels(activityWeeks(cells2025));
  expect(labels.filter((label) => label !== '')).toContain('Jun');
  expect(labels[0]).toBe('');
});

it('names each month once, on the column it starts in', () => {
  const named = monthColumnLabels(activityWeeks(cells2025)).filter(
    (label) => label !== '',
  );
  expect(new Set(named).size).toBe(named.length);
});

/* The summary is what stands in for the picture when the page is read aloud. */
it('says what the grid covers and how much of it was written', () => {
  expect(activitySummary(cells2025)).toBe(
    'Journal activity from December 2024 to January 2026: 2 days written',
  );
});

it('breaks the year down by month, gaps included', () => {
  expect(activityDescription(cells2025)).toContain(
    'June 2025: 2 of 30 days written, 500 words',
  );
  expect(activityDescription(cells2025)).toContain(
    'July 2025: 0 of 31 days written, 0 words',
  );
});
