/**
 * How writing and ratings become fills. Writing is split on the months
 * themselves, so its quartiles are the thing to pin. Every rating takes the
 * one scale the whole app shares, low, middle and high, so energy and
 * progress fill alike.
 */

import { expect, it } from 'bun:test';

import {
  energyOptions,
  progressOptions,
  ratingStepOf,
  repeatDayOptions,
} from './evening-labels.ts';
import { monthWritingLevel, ratingAnswers } from './insights-measure.ts';

it('puts every rating on the same three steps, whatever its words', () => {
  const steps = (options: typeof energyOptions | typeof progressOptions) =>
    options.map((option) => option.step);
  expect(steps(energyOptions)).toEqual(['low', 'middle', 'high']);
  expect(steps(progressOptions)).toEqual(['low', 'middle', 'high']);
  // The evening asks the repeat question yes first, and yes is the high end.
  expect(ratingStepOf(repeatDayOptions, 'yes')).toBe('high');
  expect(ratingStepOf(repeatDayOptions, 'partly')).toBe('middle');
  expect(ratingStepOf(repeatDayOptions, 'no')).toBe('low');
  expect(ratingStepOf(energyOptions, null)).toBeNull();
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
    { label: 'Drained', shade: 'low' },
    { label: 'Okay', shade: 'middle' },
    { label: 'Fresh', shade: 'high' },
  ]);
  expect(ratingAnswers('progress')).toEqual([
    { label: 'Little', shade: 'low' },
    { label: 'Solid', shade: 'middle' },
    { label: 'A lot', shade: 'high' },
  ]);
});
