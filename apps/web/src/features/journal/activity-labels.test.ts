import { expect, it } from 'bun:test';

import { activityCells, activityWeeks, activityWindow } from './activity.ts';
import {
  activityDescription,
  activitySummary,
  monthColumnLabels,
  monthYearLabel,
} from './activity-labels.ts';
import { lastArchiveYear } from './schemas/archive-query.ts';

const day = (date: string, journalWords: number) => ({
  date,
  journalWords,
  scriptureWords: 0,
  hasScripture: false,
  journalWrittenOnTheDay: true,
  scriptureUsedOnTheDay: true,
});

const today = '2026-08-26';
const namedYear = 2025;
const maximumWindowWeeks = 53;
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
 * The first grid week opens in December but contains 1 January. January owns
 * that column because the label marks the start of the month, not the Sunday.
 */
it('names a month on the week containing its first day', () => {
  const labels = monthColumnLabels(activityWeeks(cells2025));
  expect(labels.filter((label) => label !== '')).toContain('Jun');
  expect(labels[0]).toBe('Jan');
});

it('labels both boundary weeks when each contains a first day', () => {
  const named = monthColumnLabels(activityWeeks(cells2025)).filter(
    (label) => label !== '',
  );
  expect(named).toEqual([
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
    'Jan',
  ]);
});

it('labels every column of the maximum 53-week year without leaving four digits', () => {
  const window = activityWindow(today, lastArchiveYear);
  const weeks = activityWeeks(activityCells([], window));
  const labels = monthColumnLabels(weeks);

  expect(labels).toHaveLength(maximumWindowWeeks);
  expect(labels[0]).toBe('Jan');
  expect(labels.at(-1)).toBe('Jan');
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
