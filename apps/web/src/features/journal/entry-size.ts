import type { ActivityCell } from './activity-cells.ts';
import type { JournalDate } from './journal-day.ts';

export type EntrySizePoint = {
  readonly average: number;
  readonly date: JournalDate;
  readonly words: number;
};

const averageWindow = 7;

/** Typical entry length, excluding days that have no writing to average. */
export const averageWrittenDayWords = (
  points: ReadonlyArray<EntrySizePoint>,
): number | undefined => {
  const written = points.filter((point) => point.words > 0);
  if (written.length === 0) {
    return;
  }
  return Math.round(
    written.reduce((total, point) => total + point.words, 0) / written.length,
  );
};

/** Daily volume with a trailing seven-day average that includes quiet days. */
export const entrySizeSeries = (
  cells: ReadonlyArray<ActivityCell>,
): ReadonlyArray<EntrySizePoint> => {
  const days = cells.filter((cell) => cell.kind === 'day');
  return days.map((day, index) => {
    const window = days.slice(
      Math.max(0, index - averageWindow + 1),
      index + 1,
    );
    const words = window.reduce((total, current) => total + current.words, 0);
    return {
      average: Math.round(words / window.length),
      date: day.date,
      words: day.words,
    };
  });
};
