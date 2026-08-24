import { describe, expect, it } from 'bun:test';

import {
  heatmapDayCount,
  heatmapDays,
  type JournalDay,
  writtenDays,
} from '#/features/design-comparison/archive-data.ts';

import {
  activityDescription,
  activitySummary,
  heatmapWeeks,
  monthSegments,
  monthYearLabel,
  weekdayRows,
} from './heatmap-layout.ts';

const daysPerWeek = 7;
const weekCount = heatmapDayCount / daysPerWeek;

describe('heatmapWeeks', () => {
  it('lays the year out as whole weeks of seven days, in order', () => {
    const weeks = heatmapWeeks(heatmapDays);
    expect(weeks).toHaveLength(weekCount);
    expect(weeks.flat().map((cell) => cell.date)).toEqual(
      heatmapDays.map((day) => day.date),
    );
    for (const week of weeks) {
      expect(week).toHaveLength(daysPerWeek);
    }
  });

  it('keeps blank days off the ramp and puts every written day on it', () => {
    const levels = heatmapWeeks(heatmapDays).flat();
    const onTheRamp = levels.filter((cell) => cell.level !== 'none');
    expect(onTheRamp).toHaveLength(writtenDays(heatmapDays).length);
  });

  it('spends all four steps rather than crowding one', () => {
    const used = new Set(
      heatmapWeeks(heatmapDays)
        .flat()
        .map((c) => c.level),
    );
    expect([...used].sort()).toEqual(['none', 'q1', 'q2', 'q3', 'q4']);
  });
});

describe('monthSegments', () => {
  const day = (date: string): JournalDay => ({ date, words: 0 });

  it('spans each month across the weeks that start in it', () => {
    const days = [
      ...Array.from({ length: daysPerWeek }, () => day('2026-01-04')),
      ...Array.from({ length: daysPerWeek }, () => day('2026-01-11')),
      ...Array.from({ length: daysPerWeek }, () => day('2026-02-01')),
      ...Array.from({ length: daysPerWeek }, () => day('2026-02-08')),
    ];
    expect(monthSegments(heatmapWeeks(days))).toEqual([
      { key: '202601', label: 'Jan', weeks: 2 },
      { key: '202602', label: 'Feb', weeks: 2 },
    ]);
  });

  it('leaves a one-week month unlabelled but still spanning its column', () => {
    const days = [
      ...Array.from({ length: daysPerWeek }, () => day('2026-01-25')),
      ...Array.from({ length: daysPerWeek }, () => day('2026-02-01')),
      ...Array.from({ length: daysPerWeek }, () => day('2026-02-08')),
    ];
    expect(monthSegments(heatmapWeeks(days))).toEqual([
      { key: '202601', label: '', weeks: 1 },
      { key: '202602', label: 'Feb', weeks: 2 },
    ]);
  });

  it('covers every column of the real year exactly once', () => {
    const segments = monthSegments(heatmapWeeks(heatmapDays));
    const spanned = segments.reduce((total, one) => total + one.weeks, 0);
    expect(spanned).toBe(weekCount);
    expect(new Set(segments.map((one) => one.key)).size).toBe(segments.length);
  });
});

describe('activitySummary', () => {
  it('says in one sentence what the grid shows', () => {
    expect(activitySummary(heatmapDays)).toBe(
      `Journal activity from August 2025 to August 2026: ${writtenDays(heatmapDays).length} days written`,
    );
  });

  it('distinguishes same-count years by monthly distribution and volume', () => {
    const first: ReadonlyArray<JournalDay> = [
      { date: '2026-01-01', words: 200 },
      { date: '2026-01-02', words: 0 },
      { date: '2026-02-01', words: 300 },
      { date: '2026-02-02', words: 0 },
    ];
    const second: ReadonlyArray<JournalDay> = [
      { date: '2026-01-01', words: 0 },
      { date: '2026-01-02', words: 0 },
      { date: '2026-02-01', words: 100 },
      { date: '2026-02-02', words: 900 },
    ];

    expect(writtenDays(first)).toHaveLength(writtenDays(second).length);
    expect(activityDescription(first)).toBe(
      'Monthly breakdown. January 2026: 1 of 2 days written, 200 words. February 2026: 1 of 2 days written, 300 words.',
    );
    expect(activityDescription(second)).toBe(
      'Monthly breakdown. January 2026: 0 of 2 days written, 0 words. February 2026: 2 of 2 days written, 1,000 words.',
    );
  });
});

it('names the month and year a date falls in', () => {
  expect(monthYearLabel('2026-03-09')).toBe('March 2026');
  expect(monthYearLabel('2025-12-31')).toBe('December 2025');
});

it('hints at three weekdays down the seven rows', () => {
  expect(weekdayRows).toHaveLength(daysPerWeek);
  expect(
    weekdayRows.filter((row) => row.hint !== '').map((r) => r.hint),
  ).toEqual(['Mon', 'Wed', 'Fri']);
});
