/**
 * One made-up journal day, as the preview sample data stores it, and the parts
 * every sample day is built from.
 *
 * Every time on a day is a time on that day's wall clock in the journal's zone,
 * because the streaks count a section only when it was first used on the day
 * it is about, and the archive and the review pages read those times back.
 */

import type { JournalDate } from '../journal-day.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import type { Energy, Progress, RepeatDay } from '../schemas/day-rating.ts';
import { sampleAgentNote } from './sample-agent-note.ts';
import { instantAt } from './sample-clock.ts';
import { type Random, weighted } from './sample-random.ts';
import { type MetricsSource, sampleDayMetrics } from './sample-wrap.ts';

export type SampleEntry = {
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  /** A passage in the house style, or empty when none was noted. */
  readonly scriptureReference: string;
  /** When each section was first used, or null when it never was. */
  readonly journalFirstUsedAt: Date | null;
  readonly scriptureFirstUsedAt: Date | null;
  readonly updatedAt: Date;
  /** The evening as it was changed later, after its note was written. */
  readonly laterJournalMarkdown?: string;
};

export type SampleRating = {
  readonly energy: Energy | null;
  readonly progress: Progress | null;
  readonly repeatDay: RepeatDay | null;
  readonly updatedAt: Date;
  readonly closedAt: Date | null;
};

export type SampleWrap = {
  readonly dayMetrics: DayMetrics;
  readonly generatedAt: Date;
};

export type SampleNote =
  | {
      readonly status: 'ready';
      readonly note: string;
      readonly basedOnRevision: number;
      readonly requestedAt: Date;
      readonly generatedAt: Date;
    }
  | {
      readonly status: 'failed';
      readonly error: string;
      readonly requestedAt: Date;
    };

export type SampleDay = {
  readonly date: JournalDate;
  readonly entry?: SampleEntry;
  readonly rating?: SampleRating;
  readonly wrap?: SampleWrap;
  readonly note?: SampleNote;
};

/** What every part of one day is drawn with. */
export type DayContext = {
  readonly random: Random;
  readonly timeZone: string;
  readonly date: JournalDate;
};

const millisecondsPerMinute = 60_000;
const wrapHour = 22;
const noteMinutes = 1;

export const at = (context: DayContext, hour: number, minute: number): Date =>
  instantAt(context.date, hour, minute, context.timeZone);

export const minutesAfter = (instant: Date, minutes: number): Date =>
  new Date(instant.getTime() + minutes * millisecondsPerMinute);

export const latest = (...instants: ReadonlyArray<Date | null>): Date => {
  const times = instants.flatMap((instant) =>
    instant === null ? [] : [instant.getTime()],
  );
  if (times.length === 0) {
    throw new RangeError('A day needs at least one time.');
  }
  return new Date(Math.max(...times));
};

export type Ratings = Pick<SampleRating, 'energy' | 'progress' | 'repeatDay'>;

/** Ratings as a run of ordinary days spreads them, mostly middling. */
export const drawRatings = (random: Random): Ratings => ({
  energy: weighted<Energy>(random, [
    { value: 'drained', weight: 2 },
    { value: 'okay', weight: 5 },
    { value: 'fresh', weight: 3 },
  ]),
  progress: weighted<Progress>(random, [
    { value: 'little', weight: 2 },
    { value: 'solid', weight: 5 },
    { value: 'a_lot', weight: 3 },
  ]),
  repeatDay: weighted<RepeatDay>(random, [
    { value: 'yes', weight: 5 },
    { value: 'partly', weight: 4 },
    { value: 'no', weight: 1 },
  ]),
});

export const ratedAt = (
  ratings: Ratings,
  updatedAt: Date,
  closed: boolean,
): SampleRating => ({
  ...ratings,
  updatedAt,
  closedAt: closed ? updatedAt : null,
});

/** /wrap runs before the day is closed, so the note can read its numbers. */
export const wrapFor = (
  context: DayContext,
  metricsVersion: 1 | 2,
  unreachable?: ReadonlyArray<MetricsSource>,
): SampleWrap => ({
  dayMetrics: sampleDayMetrics({ ...context, metricsVersion, unreachable }),
  generatedAt: at(context, wrapHour, 0),
});

/**
 * The note closing the day asked for, written a minute later from the entry's
 * revision then, which is 0 when nothing was written.
 */
export const readyNote = (
  random: Random,
  rating: SampleRating,
  requestedAt: Date,
  basedOnRevision: number,
): SampleNote => ({
  status: 'ready',
  note: sampleAgentNote(random, rating),
  basedOnRevision,
  requestedAt,
  generatedAt: minutesAfter(requestedAt, noteMinutes),
});

/** Whether the day leaves anything to store. */
export const isStored = (day: SampleDay): boolean =>
  day.entry !== undefined ||
  day.rating !== undefined ||
  day.wrap !== undefined ||
  day.note !== undefined;
