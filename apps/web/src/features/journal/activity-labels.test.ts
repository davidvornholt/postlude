import { expect, it } from 'bun:test';

import {
  type ActivitySource,
  activityCells,
  activityWeeks,
} from './activity-cells.ts';
import {
  activityDayDetails,
  activityDescription,
  activitySummary,
  monthColumnLabels,
  monthYearLabel,
} from './activity-labels.ts';

const day = (date: string, journalWords: number): ActivitySource => ({
  date,
  journalWords,
  scriptureWords: 0,
  energy: null,
  progress: null,
});

const today = '2026-08-26';
const longDay = 400;
const shortDay = 100;
const groupedWords = 1000;
const year2025 = { from: '2025-01-01', to: '2025-12-31' } as const;
const year2026 = { from: '2026-01-01', to: '2026-12-31' } as const;

const cells2025 = activityCells(
  [day('2025-06-01', longDay), day('2025-06-08', shortDay)],
  year2025,
  today,
);

it('gives each activity square an exact hover and keyboard reading', () => {
  expect(
    activityDayDetails({
      kind: 'day',
      date: '2026-08-26',
      shade: 'q2',
      words: 120,
      energy: 'fresh',
      progress: 'a_lot',
    }),
  ).toBe(
    'Wednesday, August 26, 2026 · 120 words · Energy fresh · Progress a lot',
  );
  expect(
    activityDayDetails({
      kind: 'day',
      date: '2026-08-25',
      shade: 'none',
      words: 0,
      energy: null,
      progress: null,
    }),
  ).toBe('Tuesday, August 25, 2026 · No writing');
});

it('displays early calendar years without storage padding', () => {
  expect(monthYearLabel('0001-01-01')).toBe('January 1');
  expect(monthYearLabel('0099-02-01')).toBe('February 99');
  expect(monthYearLabel('0100-03-01')).toBe('March 100');
});

it('names each month once, over the week that holds its first day', () => {
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
  ]);
});

/* The summary is what stands in for the picture when the page is read aloud. */
it('says what the grid covers, how it is shaded, and how much was written', () => {
  expect(activitySummary(cells2025)).toBe(
    'Journal activity from January 2025 to December 2025, shaded by words written: 2 days written',
  );
  expect(activitySummary(cells2025, 'energy')).toContain('shaded by energy');
});

it('breaks the year down by month, gaps included', () => {
  expect(activityDescription(cells2025)).toContain(
    'June 2025: 2 days written out of 30 days, 500 words',
  );
  expect(activityDescription(cells2025)).toContain(
    'July 2025: 0 days written out of 31 days, 0 words',
  );
});

it('counts each answer of a month when shaded by a rating', () => {
  const cells = activityCells(
    [
      { ...day('2025-06-01', longDay), energy: 'fresh' },
      { ...day('2025-06-02', longDay), energy: 'okay' },
    ],
    { from: '2025-06-01', to: '2025-06-03' },
    today,
    'energy',
  );
  expect(activityDescription(cells, 'energy')).toBe(
    'Monthly breakdown. June 2025: energy fresh 1, okay 1, drained 0, not rated 1.',
  );
});

it('does not announce future days as unwritten in the current year', () => {
  const cells = activityCells([], year2026, today);
  const description = activityDescription(cells);

  expect(activitySummary(cells)).toBe(
    'Journal activity from January 2026 to August 2026, shaded by words written: 0 days written',
  );
  expect(description).toContain(
    'August 2026: 0 days written out of 26 days, 0 words',
  );
  expect(description).not.toContain('September 2026');
});

it('says a range that has not started has not started', () => {
  const cells = activityCells(
    [],
    { from: '2027-01-01', to: '2027-12-31' },
    today,
  );

  expect(activitySummary(cells)).toBe(
    'Journal activity: this range has not started',
  );
  expect(activityDescription(cells)).toBe('This range has not started.');
});

it('uses singular counts in the activity image description', () => {
  const cells = activityCells(
    [day(today, 1)],
    { from: today, to: today },
    today,
  );

  expect(activitySummary(cells)).toBe(
    'Journal activity from August 2026 to August 2026, shaded by words written: 1 day written',
  );
  expect(activityDescription(cells)).toBe(
    'Monthly breakdown. August 2026: 1 day written out of 1 day, 1 word.',
  );
});

it('groups counts in the activity image description', () => {
  const cells = activityCells(
    [day(today, groupedWords)],
    { from: today, to: today },
    today,
  );

  expect(activityDescription(cells)).toContain('1,000 words');
});
