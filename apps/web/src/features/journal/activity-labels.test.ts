import { expect, it } from 'bun:test';
import { activityWindow } from './activity.ts';
import { activityCells, activityWeeks } from './activity-cells.ts';
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
const currentNamedYear = 2026;
const maximumWindowWeeks = 53;
const longDay = 400;
const shortDay = 100;

const window2025 = activityWindow(today, namedYear);
const cells2025 = activityCells(
  [day('2025-06-01', longDay), day('2025-06-08', shortDay)],
  window2025,
  today,
);

it('names a month and its year in full', () => {
  expect(monthYearLabel('2025-06-01')).toBe('June 2025');
});

it('displays early calendar years without storage padding', () => {
  expect(monthYearLabel('0001-01-01')).toBe('January 1');
  expect(monthYearLabel('0099-02-01')).toBe('February 99');
  expect(monthYearLabel('0100-03-01')).toBe('March 100');
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
  const weeks = activityWeeks(activityCells([], window, today));
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
    'June 2025: 2 days written out of 30 days, 500 words',
  );
  expect(activityDescription(cells2025)).toContain(
    'July 2025: 0 days written out of 31 days, 0 words',
  );
});

it('does not announce future days as unwritten in a current named year', () => {
  const cells = activityCells(
    [],
    activityWindow(today, currentNamedYear),
    today,
  );
  const description = activityDescription(cells);

  expect(activitySummary(cells)).toBe(
    'Journal activity from December 2025 to August 2026: 0 days written',
  );
  expect(description).toContain(
    'August 2026: 0 days written out of 26 days, 0 words',
  );
  expect(description).not.toContain('September 2026');
  expect(description).not.toContain('January 2027');
});

it('does not announce future days in the rolling week', () => {
  const cells = activityCells([], activityWindow(today), today);

  expect(activityDescription(cells)).toContain(
    'August 2026: 0 days written out of 26 days, 0 words',
  );
  expect(activityDescription(cells)).not.toContain('29 days');
});

it('uses singular counts in the activity image description', () => {
  const cells = activityCells(
    [day(today, 1)],
    { from: today, to: today },
    today,
  );

  expect(activitySummary(cells)).toBe(
    'Journal activity from August 2026 to August 2026: 1 day written',
  );
  expect(activityDescription(cells)).toBe(
    'Monthly breakdown. August 2026: 1 day written out of 1 day, 1 word.',
  );
});

it('groups counts in the activity image description', () => {
  const cells = activityCells(
    [day(today, 1000)],
    { from: today, to: today },
    today,
  );

  expect(activityDescription(cells)).toContain('1,000 words');
});
