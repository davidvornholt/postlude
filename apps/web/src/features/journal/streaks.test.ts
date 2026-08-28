import { expect, it } from 'bun:test';

import type { ActivityDay } from './activity.ts';
import { journalStreak, scriptureStreak, streakOf } from './streaks.ts';

const day = (
  date: string,
  overrides: Partial<ActivityDay> = {},
): ActivityDay => ({
  date,
  journalWords: 0,
  scriptureWords: 0,
  hasScripture: false,
  journalWrittenOnTheDay: true,
  scriptureUsedOnTheDay: true,
  ...overrides,
});

const wrote = (date: string, overrides: Partial<ActivityDay> = {}) =>
  day(date, { journalWords: 120, ...overrides });

it('counts nothing as no run at all', () => {
  expect(streakOf([], '2026-08-26')).toEqual({ current: 0, longest: 0 });
});

it('counts the run the writer is on when today is already written', () => {
  const run = ['2026-08-24', '2026-08-25', '2026-08-26'];
  expect(streakOf(run, '2026-08-26').current).toBe(run.length);
});

/*
 * The evening today is the page for has not finished. A run that reaches
 * yesterday is still the run the writer is on, and calling it broken at four in
 * the morning would tell them they had lost something they had not.
 */
it('keeps a run alive on a day that has not been written yet', () => {
  const streak = streakOf(['2026-08-24', '2026-08-25'], '2026-08-26');
  expect(streak.current).toBe(2);
});

it('ends a run that stopped before yesterday', () => {
  const streak = streakOf(['2026-08-22', '2026-08-23'], '2026-08-26');
  expect(streak).toEqual({ current: 0, longest: 2 });
});

it('remembers the longest run even after it has ended', () => {
  const streak = streakOf(
    [
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-08-25',
      '2026-08-26',
    ],
    '2026-08-26',
  );
  expect(streak).toEqual({ current: 2, longest: 4 });
});

/* A run has to survive the end of a month and the end of a year. */
it('counts across a month boundary and a leap day', () => {
  const run = ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'];
  expect(streakOf(run, '2028-03-01').current).toBe(run.length);
});

/*
 * A planned future day is readable, but it must not report a run the writer is
 * not on yet.
 */
it('ignores a day after today', () => {
  const streak = streakOf(['2026-08-20', '2027-01-01'], '2026-08-26');
  expect(streak).toEqual({ current: 0, longest: 1 });
});

it('leaves a retroactive entry out of the run it would have repaired', () => {
  const days = [
    wrote('2026-08-23'),
    wrote('2026-08-24', { journalWrittenOnTheDay: false }),
    wrote('2026-08-25'),
    wrote('2026-08-26'),
  ];
  expect(journalStreak(days, '2026-08-26')).toEqual({
    current: 2,
    longest: 2,
  });
});

it('counts the two habits separately', () => {
  const days = [
    day('2026-08-24', { journalWords: 300, scriptureWords: 40 }),
    day('2026-08-25', { journalWords: 300 }),
    day('2026-08-26', { scriptureWords: 40 }),
  ];
  expect(journalStreak(days, '2026-08-26').current).toBe(2);
  expect(scriptureStreak(days, '2026-08-26').current).toBe(1);
});

it('does not let one section first used later break the other streak', () => {
  const days = [
    day('2026-08-25', {
      journalWords: 300,
      scriptureWords: 40,
      scriptureUsedOnTheDay: false,
    }),
    day('2026-08-26', {
      journalWords: 300,
      scriptureWords: 40,
      journalWrittenOnTheDay: false,
    }),
  ];

  expect(journalStreak(days, '2026-08-26').current).toBe(1);
  expect(scriptureStreak(days, '2026-08-26').current).toBe(1);
});

/*
 * Noting what was read and writing nothing about it is still a morning the
 * writer sat down to the passage, so the reference alone keeps the run.
 */
it('counts a morning that noted a passage and no thoughts about it', () => {
  const days = [day('2026-08-26', { hasScripture: true })];
  expect(scriptureStreak(days, '2026-08-26').current).toBe(1);
});
