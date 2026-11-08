/**
 * The highlights Insights picks out. The cases worth pinning are the ones that
 * would flatter or mislead: a record claimed by a journal with nothing outside
 * the range to beat, a day still to come counted, a leap day with no date a
 * year earlier, and a year ago shown for a journal that was not there yet.
 */

import { describe, expect, it } from 'bun:test';

import type { InsightsRange } from './insights-range.ts';
import {
  fullestMonth,
  longestEntry,
  recordsOf,
  yearAgoOf,
  yearAgoTakeaway,
  yearEarlierRange,
} from './insights-records.ts';
import {
  blankDay,
  type SampleDay,
  sampleInsightsView,
  unratedDay,
} from './testing/insights-view.ts';

const today = '2026-10-28';

const written = (
  date: string,
  journalWords: number,
  scriptureWords = 0,
): SampleDay => ({ ...blankDay(date), journalWords, scriptureWords });

const asDay = ({ report: _report, ...day }: SampleDay) => ({
  ...unratedDay(day.date),
  ...day,
});

describe('longestEntry', () => {
  it('counts both sections and keeps the earlier day on a tie', () => {
    expect(
      longestEntry(
        [
          written('2026-10-01', 400, 100),
          written('2026-10-02', 450),
          written('2026-10-03', 500),
        ],
        today,
      ),
    ).toEqual({ date: '2026-10-01', words: 500 });
  });

  it('leaves out days still to come and answers nothing before any writing', () => {
    expect(
      longestEntry(
        [written('2026-10-02', 90), written('2026-10-29', 900)],
        today,
      ),
    ).toEqual({ date: '2026-10-02', words: 90 });
    expect(longestEntry([blankDay('2026-10-02')], today)).toBeUndefined();
  });
});

describe('fullestMonth', () => {
  it('picks the month with the most written days, then the most words', () => {
    const fullest = fullestMonth(
      [
        written('2026-08-01', 900),
        written('2026-09-01', 100),
        written('2026-09-02', 100),
        written('2026-10-01', 300),
        written('2026-10-02', 300),
      ].map(asDay),
      today,
    );
    expect(fullest?.month).toBe('2026-10');
    expect(fullest?.written).toBe(2);
    expect(fullest?.words).toBe(600);
  });

  it('needs two written months to compare', () => {
    expect(
      fullestMonth(
        [written('2026-10-01', 300), blankDay('2026-09-01')].map(asDay),
        today,
      ),
    ).toBeUndefined();
  });
});

describe('yearEarlierRange', () => {
  it('moves a month or a year back by one year', () => {
    expect(yearEarlierRange({ kind: 'month', month: '2026-03' })).toEqual({
      kind: 'month',
      month: '2025-03',
    });
    expect(yearEarlierRange({ kind: 'year', year: 2026 })).toEqual({
      kind: 'year',
      year: 2025,
    });
    expect(yearEarlierRange({ kind: 'year', year: 1 })).toBeUndefined();
    expect(
      yearEarlierRange({ kind: 'all', from: '2024-01-01', to: today }),
    ).toBeUndefined();
  });

  it('finds a week by its Thursday, and a leap day by the day before it', () => {
    // Week 44 of 2026 runs from October 26; its Thursday a year back is in week 44 of 2025.
    expect(yearEarlierRange({ kind: 'week', start: '2026-10-26' })).toEqual({
      kind: 'week',
      start: '2025-10-27',
    });
    // Thursday, February 29, 2024 has no date in 2023; February 28 is a Tuesday.
    expect(yearEarlierRange({ kind: 'week', start: '2024-02-26' })).toEqual({
      kind: 'week',
      start: '2023-02-27',
    });
  });
});

describe('yearAgoOf', () => {
  const history = [
    written('2025-10-03', 200, 40),
    written('2025-10-20', 300),
    written('2025-11-01', 999),
    written('2026-10-05', 120),
  ];
  const october: InsightsRange = { kind: 'month', month: '2026-10' };

  it('adds up the same month a year earlier', () => {
    expect(yearAgoOf(october, history, today)).toEqual({
      range: { kind: 'month', month: '2025-10' },
      elapsed: 31,
      written: 2,
      words: 540,
    });
  });

  it('says nothing where nothing was written a year earlier', () => {
    expect(
      yearAgoOf({ kind: 'month', month: '2026-09' }, history, today),
    ).toBeUndefined();
    expect(yearAgoOf(october, [written('2026-10-05', 120)], today)).toBe(
      undefined,
    );
  });

  it('puts the range in words for the fold', () => {
    const yearAgo = yearAgoOf(october, history, today);
    expect(yearAgo && yearAgoTakeaway(yearAgo)).toBe(
      'Written on 2 of 31 days in October 2025',
    );
    const week = yearAgoOf(
      { kind: 'week', start: '2026-10-19' },
      history,
      today,
    );
    expect(week && yearAgoTakeaway(week)).toBe(
      'Written on 1 of 7 days in week 43 of 2025',
    );
  });
});

describe('recordsOf', () => {
  const journal = [
    written('2025-10-03', 900),
    written('2026-10-02', 400),
    written('2026-10-12', 700),
    written('2026-10-20', 500),
  ];

  it('sets the range’s longest beside the journal’s when the record lies elsewhere', () => {
    const records = recordsOf(
      sampleInsightsView(journal, { kind: 'month', month: '2026-10' }, today),
    );
    expect(records?.longest).toEqual({ date: '2026-10-12', words: 700 });
    expect(records?.ofAll).toEqual({ date: '2025-10-03', words: 900 });
    expect(records?.isRecord).toBe(false);
    expect(records?.takeaway).toBe('Longest entry: 700 words on October 12');
  });

  it('calls a range’s longest the longest yet only when the journal reaches outside it', () => {
    const recent = journal.slice(1);
    const withHistory = recordsOf(
      sampleInsightsView(
        [written('2026-09-30', 100), ...recent],
        { kind: 'month', month: '2026-10' },
        today,
      ),
    );
    expect(withHistory?.isRecord).toBe(true);
    expect(withHistory?.ofAll).toBeUndefined();
    expect(withHistory?.takeaway).toBe(
      'Your longest entry yet: 700 words on October 12',
    );
    const onlyThisMonth = recordsOf(
      sampleInsightsView(recent, { kind: 'month', month: '2026-10' }, today),
    );
    expect(onlyThisMonth?.isRecord).toBe(false);
    expect(onlyThisMonth?.takeaway).toBe(
      'Longest entry: 700 words on October 12',
    );
  });

  it('names the year over all time and compares months only over a year or more', () => {
    const allTime = recordsOf(
      sampleInsightsView(
        journal,
        { kind: 'all', from: '2025-10-03', to: today },
        today,
      ),
    );
    expect(allTime?.takeaway).toBe(
      'Longest entry: 900 words on October 3, 2025',
    );
    expect(allTime?.isRecord).toBe(false);
    expect(allTime?.fullest?.month).toBe('2026-10');
    const month = recordsOf(
      sampleInsightsView(journal, { kind: 'month', month: '2026-10' }, today),
    );
    expect(month?.fullest).toBeUndefined();
  });

  it('has nothing to say about a range without writing', () => {
    expect(
      recordsOf(
        sampleInsightsView(journal, { kind: 'month', month: '2026-09' }, today),
      ),
    ).toBeUndefined();
  });
});
