/**
 * How a rating becomes a fill. Progress has three answers on the four steps
 * of the green ramp, so the mapping is the thing to pin: the hoped-for answer
 * takes the darkest step. Energy's answers take colors of their own. A day or
 * month without an answer takes none.
 */

import { expect, it } from 'bun:test';

import { energyOptions, progressOptions } from './evening-labels.ts';
import {
  averageLevel,
  energyScore,
  monthWritingLevel,
  progressScore,
  ratingAnswers,
  ratingLevel,
} from './insights-measure.ts';

it('scores an answer by its place on the evening scale, lowest first', () => {
  expect(energyOptions.map((option) => energyScore(option.value))).toEqual([
    1, 2, 3,
  ]);
  expect(progressOptions.map((option) => progressScore(option.value))).toEqual([
    1, 2, 3,
  ]);
  expect(energyScore('fresh')).toBe(3);
  expect(progressScore('little')).toBe(1);
});

it('gives a single answer the lightest, a middle or the darkest step', () => {
  expect([null, 1, 2, 3].map(ratingLevel)).toEqual(['none', 'q1', 'q2', 'q4']);
});

it('lifts a month above the middle step only when it leans to the top', () => {
  expect(averageLevel(undefined)).toBe('none');
  expect(averageLevel(1)).toBe('q1');
  expect(averageLevel(1.49)).toBe('q1');
  expect(averageLevel(1.5)).toBe('q2');
  expect(averageLevel(2)).toBe('q2');
  expect(averageLevel(2.49)).toBe('q3');
  expect(averageLevel(2.5)).toBe('q4');
  expect(averageLevel(3)).toBe('q4');
});

it('shades a month by its words a day against the other months', () => {
  const months = [10, 20, 30, 40, 50, 60, 70, 80].map((perDay) => ({
    words: perDay * 30,
    elapsed: 30,
  }));
  const level = monthWritingLevel(months);
  expect(months.map(level)).toEqual([
    'q1',
    'q1',
    'q2',
    'q2',
    'q3',
    'q3',
    'q4',
    'q4',
  ]);
  expect(level({ words: 0, elapsed: 30 })).toBe('none');
});

/* A month a week old is weighed by its week, not by the whole month. */
it('weighs a month by the days it has had so far', () => {
  const level = monthWritingLevel([
    { words: 300, elapsed: 30 },
    { words: 3000, elapsed: 30 },
  ]);
  // Twenty words a day for a week, not under five over thirty days.
  expect(level({ words: 140, elapsed: 7 })).toBe('q3');
  expect(level({ words: 0, elapsed: 0 })).toBe('none');
});

it('lists the legend in the order the evening asks, with the fill each takes', () => {
  expect(ratingAnswers('energy')).toEqual([
    { label: 'Drained', shade: 'drained' },
    { label: 'Okay', shade: 'okay' },
    { label: 'Fresh', shade: 'fresh' },
  ]);
  expect(ratingAnswers('progress')).toEqual([
    { label: 'Little', shade: 'q1' },
    { label: 'Solid', shade: 'q2' },
    { label: 'A lot', shade: 'q4' },
  ]);
});
