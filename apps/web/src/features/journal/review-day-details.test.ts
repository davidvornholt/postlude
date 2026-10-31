/** The words the review charts give a screen reader for the day in focus. */

import { describe, expect, it } from 'bun:test';

import { ratingDetails, screenTimeDetails } from './review-day-details.ts';
import { sampleReviewWeek } from './testing/review-view.ts';

const { days, today } = sampleReviewWeek;
const day = (date: string) => {
  const found = days.find((candidate) => candidate.date === date);
  if (found === undefined) {
    throw new Error(`The sample week has no ${date}.`);
  }
  return found;
};

describe('ratingDetails', () => {
  it('reads out each rating and whether the day was closed', () => {
    expect(ratingDetails(day('2026-10-26'), today)).toBe(
      'Energy: Fresh · Progress: A lot · Would repeat: Yes · Closed',
    );
    expect(ratingDetails(day('2026-10-29'), today)).toBe(
      'Energy: Okay · Progress: not rated · Would repeat: not rated · Not closed',
    );
  });

  it('says a day after today is still to come', () => {
    expect(ratingDetails(day('2026-10-31'), today)).toBe('Still to come');
  });
});

describe('screenTimeDetails', () => {
  it('reads out the screen time and its split', () => {
    expect(screenTimeDetails(day('2026-10-27'), today)).toBe(
      '6 h 52 min at the screen · 3 h 56 min focused · 1 h 28 min scattered',
    );
  });

  it('says what was not measured instead of reading it as zero', () => {
    expect(screenTimeDetails(day('2026-10-28'), today)).toBe('No report');
    expect(screenTimeDetails(day('2026-10-29'), today)).toBe(
      '8 h 25 min at the screen · focus not measured',
    );
    expect(screenTimeDetails(day('2026-10-30'), today)).toBe(
      'Screen time not measured',
    );
    expect(screenTimeDetails(day('2026-10-31'), today)).toBe('Still to come');
  });
});
