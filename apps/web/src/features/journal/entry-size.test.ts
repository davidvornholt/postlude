import { expect, it } from 'bun:test';

import type { ActivityCell } from './activity-cells.ts';
import { averageWrittenDayWords, entrySizeSeries } from './entry-size.ts';

const day = (date: string, words: number): ActivityCell => ({
  kind: 'day',
  date,
  words,
  level: words === 0 ? 'none' : 'q1',
});

const shortEntry = 100;
const longEntry = 200;
const expectedMixedAverage = 50;
const expectedWrittenDayAverage = 150;

it('shows every lived day and carries quiet days into the seven-day pace', () => {
  const series = entrySizeSeries([
    day('2026-08-24', shortEntry),
    day('2026-08-25', 0),
    day('2026-08-26', longEntry),
    { kind: 'future-padding', date: '2026-08-27' },
  ]);

  expect(series).toEqual([
    { average: shortEntry, date: '2026-08-24', words: shortEntry },
    { average: expectedMixedAverage, date: '2026-08-25', words: 0 },
    { average: shortEntry, date: '2026-08-26', words: longEntry },
  ]);
});

it('uses only the trailing seven days once the window is full', () => {
  const series = entrySizeSeries(
    Array.from({ length: 8 }, (_unused, index) =>
      day(`2026-08-${String(index + 1).padStart(2, '0')}`, (index + 1) * 10),
    ),
  );

  expect(series.at(-1)?.average).toBe(expectedMixedAverage);
});

it('averages entry length over written days rather than quiet days', () => {
  const series = entrySizeSeries([
    day('2026-08-24', shortEntry),
    day('2026-08-25', 0),
    day('2026-08-26', longEntry),
  ]);

  expect(averageWrittenDayWords(series)).toBe(expectedWrittenDayAverage);
});

it('has no written-day average when the range has no writing', () => {
  expect(
    averageWrittenDayWords(
      entrySizeSeries([day('2026-08-24', 0), day('2026-08-25', 0)]),
    ),
  ).toBeUndefined();
});
