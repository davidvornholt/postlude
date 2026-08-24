import { describe, expect, it } from 'bun:test';

import {
  generateHeatmapDays,
  heatLevel,
  heatmapDayCount,
  heatmapDays,
  heatmapSeed,
  type JournalDay,
  journalStreakDays,
  quartiles,
  writtenDays,
} from './archive-data.ts';
import { countWords, journalText, sampleDay } from './content.ts';

const dayInMilliseconds = 86_400_000;
const utcSunday = 0;
const utcSaturday = 6;
const fewestWrittenDays = 180;
const mostWrittenDays = 230;
const fewestWords = 80;
const mostWords = 900;
const sampleDayTotalWords = 254;
/** A run this short on average would mean writing at random, not in spells. */
const shortestBelievableMeanRun = 3;

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

describe('generateHeatmapDays', () => {
  it('gives the same year back for the same seed, and a different one for another', () => {
    expect(generateHeatmapDays(heatmapSeed)).toEqual(heatmapDays);
    expect(generateHeatmapDays(heatmapSeed + 1)).not.toEqual(heatmapDays);
  });

  it('covers whole Sunday-aligned weeks up to the day being written', () => {
    expect(heatmapDays).toHaveLength(heatmapDayCount);
    expect(heatmapDays[0]?.date).toBe('2025-08-17');
    expect(heatmapDays.at(-1)?.date).toBe('2026-08-22');
    expect(weekdayOf(heatmapDays[0]?.date ?? '')).toBe(utcSunday);
    expect(weekdayOf(heatmapDays.at(-1)?.date ?? '')).toBe(utcSaturday);
  });

  it('ends with the same date, word count, and heat level as the sample day', () => {
    const sampleDayWords =
      countWords(journalText) +
      sampleDay.scripture.notes.reduce(
        (total, note) => total + countWords(note),
        0,
      );
    const finalDay = heatmapDays.at(-1);

    expect(finalDay).toEqual({
      date: sampleDay.isoDate,
      words: sampleDayWords,
    });
    expect(sampleDayWords).toBe(sampleDayTotalWords);
    expect(heatLevel(finalDay?.words ?? 0, quartiles(heatmapDays))).toBe('q1');
  });

  it('runs one calendar day at a time, with no gap or repeat', () => {
    const steps = heatmapDays.map((current, index) => {
      const previous = heatmapDays[index - 1];
      return previous === undefined
        ? dayInMilliseconds
        : Date.parse(`${current.date}T00:00:00Z`) -
            Date.parse(`${previous.date}T00:00:00Z`);
    });
    expect(new Set(steps)).toEqual(new Set([dayInMilliseconds]));
  });

  it('writes on roughly two days in three, at a believable length', () => {
    const written = writtenDays(heatmapDays);
    expect(written.length).toBeGreaterThan(fewestWrittenDays);
    expect(written.length).toBeLessThan(mostWrittenDays);
    const outOfRange = written.filter(
      (current) => current.words < fewestWords || current.words > mostWords,
    );
    expect(outOfRange).toEqual([]);
  });

  it('writes in spells rather than at random', () => {
    // A coin toss per day would break the year into far more, far shorter runs
    // than a person who writes for a week and then lapses for a few days.
    const runs: Array<number> = [];
    let open = 0;
    for (const current of heatmapDays) {
      if (current.words > 0) {
        open += 1;
      } else if (open > 0) {
        runs.push(open);
        open = 0;
      }
    }
    if (open > 0) {
      runs.push(open);
    }
    const meanRun = writtenDays(heatmapDays).length / runs.length;
    expect(meanRun).toBeGreaterThan(shortestBelievableMeanRun);
  });

  it('ends on the streak the archive states in words', () => {
    const tail = heatmapDays.slice(-journalStreakDays);
    expect(tail.filter((current) => current.words > 0)).toHaveLength(
      journalStreakDays,
    );
    // The day before it has to be blank, or the run the page names is longer
    // than the number beside it.
    expect(heatmapDays.at(-journalStreakDays - 1)?.words).toBe(0);
  });
});

const dayOf = (words: number): JournalDay => ({ date: '2026-01-01', words });

describe('quartiles', () => {
  const lowest = 100;
  const lower = 200;
  const higher = 300;
  const highest = 400;

  it('splits the written days by nearest rank, ignoring the blank ones', () => {
    const days = [lowest, lower, higher, highest, 0, 0].map(dayOf);
    expect(quartiles(days)).toEqual([lowest, lower, higher]);
  });

  it('answers with zeroes when nothing has been written', () => {
    expect(quartiles([dayOf(0)])).toEqual([0, 0, 0]);
  });
});

describe('heatLevel', () => {
  const firstBoundary = 100;
  const secondBoundary = 200;
  const thirdBoundary = 300;
  const thresholds = [firstBoundary, secondBoundary, thirdBoundary] as const;

  it('puts a day exactly on a boundary in the lower step', () => {
    expect(heatLevel(firstBoundary, thresholds)).toBe('q1');
    expect(heatLevel(firstBoundary + 1, thresholds)).toBe('q2');
    expect(heatLevel(secondBoundary, thresholds)).toBe('q2');
    expect(heatLevel(secondBoundary + 1, thresholds)).toBe('q3');
    expect(heatLevel(thirdBoundary, thresholds)).toBe('q3');
    expect(heatLevel(thirdBoundary + 1, thresholds)).toBe('q4');
  });

  it('keeps a day with no entry off the ramp entirely', () => {
    expect(heatLevel(0, thresholds)).toBe('none');
  });
});
