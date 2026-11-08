/**
 * The years before the last few days: which days were written comes from
 * `sampleJournal`, and this decides what else each one holds. Most written
 * days are rated and closed. /wrap has only been measuring the last couple of
 * months, and agent notes came with it, so older days have neither.
 */

import type { ActivityDay } from '../activity.ts';
import { shiftJournalDate } from '../journal-day.ts';
import {
  at,
  type DayContext,
  drawRatings,
  latest,
  minutesAfter,
  ratedAt,
  readyNote,
  type SampleDay,
  type SampleEntry,
  type SampleRating,
  wrapFor,
} from './sample-day.ts';
import { sampleEvening } from './sample-evening.ts';
import { sampleMorningNotes, sampleReference } from './sample-morning.ts';
import { between, chance, type Span, within } from './sample-random.ts';

/** The oldest day /wrap measured, counted back from today. */
export const wrapWindowDays = 70;
/** Before this many days ago, /wrap measured under its first version. */
export const firstVersionBefore = 40;

const wrapChance = 0.85;
const ratingChance = 0.85;
const partialRatingChance = 0.08;
const ratingOnlyChance = 0.04;
const writtenLaterChance = 0.03;
const morningHour = 6;
const morningMinutes = 110;
const eveningHour = 20;
const eveningMinutes = 115;
const nextMorningHour = 8;
const nextMorningMinutes = 200;
/** Days are closed after /wrap has run, so their notes can read its numbers. */
const closingHour = 22;
const closingDelay: Span = { low: 5, high: 50 };

/** An evening written the next morning, which its streak doesn't count. */
const writtenLater = (context: DayContext) =>
  at(
    { ...context, date: shiftJournalDate(context.date, 1) },
    nextMorningHour,
    between(context.random, 0, nextMorningMinutes),
  );

const historyEntry = (
  context: DayContext,
  activity: ActivityDay,
): SampleEntry => {
  const { random } = context;
  const reference = activity.hasScripture ? sampleReference(random) : '';
  const notes = activity.scriptureWords > 0 ? sampleMorningNotes(random) : '';
  const scriptureFirstUsedAt =
    reference === '' && notes === ''
      ? null
      : at(context, morningHour, between(random, 0, morningMinutes));
  const journalFirstUsedAt = chance(random, writtenLaterChance)
    ? writtenLater(context)
    : at(context, eveningHour, between(random, 0, eveningMinutes));
  return {
    journalMarkdown: sampleEvening(random, context.date, activity.journalWords),
    scriptureMarkdown: notes,
    scriptureReference: reference,
    journalFirstUsedAt,
    scriptureFirstUsedAt,
    updatedAt: latest(journalFirstUsedAt, scriptureFirstUsedAt),
  };
};

const historyRating = (
  context: DayContext,
  entry: SampleEntry | undefined,
): SampleRating | undefined => {
  const { random } = context;
  if (!chance(random, entry === undefined ? ratingOnlyChance : ratingChance)) {
    return;
  }
  const ratedTime = minutesAfter(
    latest(entry?.updatedAt ?? null, at(context, closingHour, 0)),
    within(random, closingDelay),
  );
  const ratings = drawRatings(random);
  return chance(random, partialRatingChance)
    ? ratedAt({ ...ratings, progress: null, repeatDay: null }, ratedTime, false)
    : ratedAt(ratings, ratedTime, true);
};

/** Day `daysAgo` of the history, with `activity` when it was written. */
export const sampleHistoryDay = (
  context: DayContext,
  daysAgo: number,
  activity: ActivityDay | undefined,
): SampleDay => {
  const entry =
    activity === undefined ? undefined : historyEntry(context, activity);
  const rating = historyRating(context, entry);
  const measured =
    daysAgo <= wrapWindowDays && chance(context.random, wrapChance);
  const wrap = measured
    ? wrapFor(context, daysAgo > firstVersionBefore ? 1 : 2)
    : undefined;
  const note =
    measured && rating !== undefined && rating.closedAt !== null
      ? readyNote(
          context.random,
          rating,
          rating.closedAt,
          entry === undefined ? 0 : 1,
        )
      : undefined;
  return {
    date: context.date,
    ...(entry === undefined ? {} : { entry }),
    ...(rating === undefined ? {} : { rating }),
    ...(wrap === undefined ? {} : { wrap }),
    ...(note === undefined ? {} : { note }),
  };
};
