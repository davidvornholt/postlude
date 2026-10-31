import { describe, expect, it } from 'bun:test';

import {
  categoryTotals,
  comparableDays,
  comparisonVersion,
  metricsStateOf,
  otherVersionDays,
  ratingCounts,
  sentMailCount,
  tally,
  versionChanges,
} from './review-summary.ts';
import type { DayMetrics } from './schemas/day-metrics.ts';
import { sampleDayMetrics } from './testing/evening-view.ts';
import { sampleReviewWeek, unratedDay } from './testing/review-view.ts';

const { days, today } = sampleReviewWeek;

describe('metricsStateOf', () => {
  it('tells a day still to come from one without a report', () => {
    expect(metricsStateOf(unratedDay('2026-10-31'), today)).toBe('upcoming');
    expect(metricsStateOf(unratedDay('2026-10-28'), today)).toBe('no-report');
    expect(
      metricsStateOf(
        {
          ...unratedDay('2026-10-27'),
          metrics: sampleDayMetrics('2026-10-27'),
        },
        today,
      ),
    ).toBe('measured');
  });
});

describe('metrics versions', () => {
  it('compares the days of the newest version and sets the others aside', () => {
    expect(comparisonVersion(days)).toBe(2);
    expect(comparableDays(days).map((metrics) => metrics.day)).toEqual([
      '2026-10-27',
      '2026-10-29',
      '2026-10-30',
    ]);
    expect(otherVersionDays(days).map((day) => day.date)).toEqual([
      '2026-10-26',
    ]);
  });

  it('marks where the version changes, across a day without a report', () => {
    expect(versionChanges(days)).toEqual([{ index: 1, version: 2 }]);
    const gap = [days[1], days[2], days[3]].flatMap((day) =>
      day === undefined ? [] : [day],
    );
    expect(versionChanges(gap)).toEqual([]);
  });

  it('has nothing to compare when no day has a report', () => {
    const empty = [unratedDay('2026-10-26'), unratedDay('2026-10-27')];
    expect(comparisonVersion(empty)).toBe(undefined);
    expect(comparableDays(empty)).toEqual([]);
  });
});

describe('tally', () => {
  it('adds up what was measured and counts the rest as missing', () => {
    expect(tally(comparableDays(days), (day) => day.activeMinutes)).toEqual({
      total: 412 + 505,
      measured: 2,
      missing: 1,
    });
  });
});

describe('sentMailCount', () => {
  it('adds every mailbox', () => {
    expect(
      sentMailCount({
        ...sampleDayMetrics('2026-10-27'),
        sentMails: [
          { mailbox: 'Work', count: 4 },
          { mailbox: 'Home', count: 0 },
        ],
      }),
    ).toBe(4);
  });

  it('measured nothing when a mailbox was not read or none was', () => {
    const day = sampleDayMetrics('2026-10-27');
    expect(
      sentMailCount({
        ...day,
        sentMails: [
          { mailbox: 'Work', count: 4 },
          { mailbox: 'Home', count: null },
        ],
      }),
    ).toBe(null);
    expect(sentMailCount({ ...day, sentMails: [] })).toBe(null);
  });
});

describe('categoryTotals', () => {
  it('keeps a category nobody measured apart from a measured zero', () => {
    expect(categoryTotals(comparableDays(days))).toEqual([
      { id: 'writing', label: 'Writing', minutes: 280, missing: 0 },
      { id: 'reading', label: 'Reading', minutes: 192, missing: 0 },
      { id: 'admin', label: 'Admin', minutes: null, missing: 2 },
    ]);
    const withCategories = (
      date: string,
      categories: DayMetrics['categories'],
    ): DayMetrics => ({ ...sampleDayMetrics(date), categories });
    expect(
      categoryTotals([
        withCategories('2026-10-27', [
          { id: 'admin', label: 'Admin', minutes: null },
          { id: 'calls', label: 'Calls', minutes: 0 },
          { id: 'reading', label: 'Reading', minutes: 30 },
        ]),
        withCategories('2026-10-28', [
          { id: 'admin', label: 'Admin', minutes: null },
          { id: 'calls', label: 'Calls', minutes: 0 },
          { id: 'reading', label: 'Reading', minutes: null },
        ]),
      ]),
    ).toEqual([
      { id: 'reading', label: 'Reading', minutes: 30, missing: 1 },
      { id: 'calls', label: 'Calls', minutes: 0, missing: 0 },
      { id: 'admin', label: 'Admin', minutes: null, missing: 2 },
    ]);
  });
});

describe('ratingCounts', () => {
  it('counts each answer and the past days without one', () => {
    const { counts, unrated } = ratingCounts(
      days,
      today,
      ['drained', 'okay', 'fresh'],
      (day) => day.energy,
    );
    expect(Object.fromEntries(counts)).toEqual({
      drained: 1,
      okay: 2,
      fresh: 1,
    });
    expect(unrated).toBe(1);
  });
});
