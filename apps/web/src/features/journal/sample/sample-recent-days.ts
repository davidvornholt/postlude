/**
 * The last ten days, each laid out by hand so that a preview shows every state
 * a recent day can be in: today half written, a day closed with its note, a
 * note gone stale, one that failed, a day only rated, an empty day, and days
 * with only the morning, only a reference, or only part of /wrap's numbers.
 */

import { type JournalDate, shiftJournalDate } from '../journal-day.ts';
import { timedOutMessage } from '../services/agent-notes.ts';
import {
  at,
  type DayContext,
  latest,
  minutesAfter,
  ratedAt,
  readyNote,
  type SampleDay,
  type SampleEntry,
  wrapFor,
} from './sample-day.ts';
import { sampleEvening } from './sample-evening.ts';
import { sampleMorningNotes, sampleReference } from './sample-morning.ts';
import type { Random } from './sample-random.ts';
import { fillTemplate } from './sample-text.ts';

export type RecentDaysInput = {
  readonly random: Random;
  readonly timeZone: string;
  readonly today: JournalDate;
  /** Today's times are now: the morning and the draft were written already. */
  readonly now: Date;
};

const todayDraftWords = 60;
const longEvening = 480;
const middleEvening = 260;
const shortEvening = 180;
const morningHour = 7;
const eveningHour = 21;
const closingHour = 22;
const closingMinute = 20;
const eveningMinute = 10;
const nextMorningHour = 7;
const nextMorningMinute = 40;
const failedNoteMinutes = 2;

type EntryParts = {
  readonly evening?: number;
  readonly reference?: boolean;
  readonly notes?: boolean;
};

const recentEntry = (context: DayContext, parts: EntryParts): SampleEntry => {
  const { random } = context;
  const reference = parts.reference === true ? sampleReference(random) : '';
  const notes = parts.notes === true ? sampleMorningNotes(random) : '';
  const scriptureFirstUsedAt =
    reference === '' && notes === '' ? null : at(context, morningHour, 0);
  const journalFirstUsedAt =
    parts.evening === undefined
      ? null
      : at(context, eveningHour, eveningMinute);
  return {
    journalMarkdown:
      parts.evening === undefined
        ? ''
        : sampleEvening(random, context.date, parts.evening),
    scriptureMarkdown: notes,
    scriptureReference: reference,
    journalFirstUsedAt,
    scriptureFirstUsedAt,
    updatedAt: latest(journalFirstUsedAt, scriptureFirstUsedAt),
  };
};

const today = (input: RecentDaysInput, context: DayContext): SampleDay => ({
  date: context.date,
  entry: {
    journalMarkdown: sampleEvening(input.random, context.date, todayDraftWords),
    scriptureMarkdown: sampleMorningNotes(input.random),
    scriptureReference: sampleReference(input.random),
    journalFirstUsedAt: input.now,
    scriptureFirstUsedAt: input.now,
    updatedAt: input.now,
  },
});

const closedWithNote = (context: DayContext): SampleDay => {
  const closedAt = at(context, closingHour, closingMinute);
  const rating = ratedAt(
    { energy: 'fresh', progress: 'a_lot', repeatDay: 'yes' },
    closedAt,
    true,
  );
  return {
    date: context.date,
    entry: recentEntry(context, {
      evening: longEvening,
      reference: true,
      notes: true,
    }),
    rating,
    wrap: wrapFor(context, 2),
    note: readyNote(context.random, rating, closedAt, 1),
  };
};

/** Reopened the next morning and added to, so its note no longer fits. */
const staleNote = (context: DayContext): SampleDay => {
  const closedAt = at(context, closingHour, closingMinute);
  const rating = ratedAt(
    { energy: 'okay', progress: 'solid', repeatDay: 'partly' },
    closedAt,
    true,
  );
  const entry = recentEntry(context, {
    evening: middleEvening,
    reference: true,
  });
  const addendum = fillTemplate(
    context.random,
    'Nachtrag am nächsten Morgen: {Ich habe besser geschlafen als gedacht|Mira hat geschrieben, dass alles geklappt hat|Der Ärger von gestern ist schon kleiner geworden}.',
  );
  const reopenedAt = at(
    { ...context, date: shiftJournalDate(context.date, 1) },
    nextMorningHour,
    nextMorningMinute,
  );
  return {
    date: context.date,
    entry: {
      ...entry,
      laterJournalMarkdown: `${entry.journalMarkdown}\n\n${addendum}`,
      updatedAt: reopenedAt,
    },
    rating: { ...rating, updatedAt: reopenedAt, closedAt: null },
    wrap: wrapFor(context, 2),
    note: readyNote(context.random, rating, closedAt, 1),
  };
};

const failedNote = (context: DayContext): SampleDay => {
  const closedAt = at(context, closingHour, closingMinute);
  return {
    date: context.date,
    entry: recentEntry(context, {
      evening: middleEvening,
      reference: true,
      notes: true,
    }),
    rating: ratedAt(
      { energy: 'drained', progress: 'little', repeatDay: 'no' },
      closedAt,
      true,
    ),
    wrap: wrapFor(context, 2),
    note: {
      status: 'failed',
      error: timedOutMessage,
      requestedAt: minutesAfter(closedAt, -failedNoteMinutes),
    },
  };
};

/** Energy rated, the rest not yet, and no report from /wrap. */
const partlyRated = (context: DayContext): SampleDay => ({
  date: context.date,
  entry: recentEntry(context, { evening: shortEvening }),
  rating: ratedAt(
    { energy: 'okay', progress: null, repeatDay: null },
    at(context, closingHour, 0),
    false,
  ),
});

const morningNotesOnly = (context: DayContext): SampleDay => ({
  date: context.date,
  entry: recentEntry(context, { notes: true }),
  wrap: wrapFor(context, 2),
});

const calendarOutOfReach = (context: DayContext): SampleDay => {
  const closedAt = at(context, closingHour, closingMinute);
  const rating = ratedAt(
    { energy: 'okay', progress: 'a_lot', repeatDay: 'yes' },
    closedAt,
    true,
  );
  return {
    date: context.date,
    entry: recentEntry(context, { evening: middleEvening, reference: true }),
    rating,
    wrap: wrapFor(context, 2, ['calendar', 'mail']),
    note: readyNote(context.random, rating, closedAt, 1),
  };
};

const ratedOnly = (context: DayContext): SampleDay => ({
  date: context.date,
  rating: ratedAt(
    { energy: 'drained', progress: 'solid', repeatDay: 'partly' },
    at(context, closingHour, 0),
    false,
  ),
  wrap: wrapFor(context, 2),
});

const referenceOnly = (context: DayContext): SampleDay => ({
  date: context.date,
  entry: recentEntry(context, { reference: true }),
});

const designs: ReadonlyArray<
  (context: DayContext, input: RecentDaysInput) => SampleDay
> = [
  (context, input) => today(input, context),
  closedWithNote,
  staleNote,
  failedNote,
  partlyRated,
  morningNotesOnly,
  calendarOutOfReach,
  (context) => ({ date: context.date }),
  ratedOnly,
  referenceOnly,
];

/** How many days back the hand-made days reach; history starts after them. */
export const recentDayCount = designs.length;

/** Today first, then each day before it. */
export const sampleRecentDays = (
  input: RecentDaysInput,
): ReadonlyArray<SampleDay> =>
  designs.map((design, daysAgo) =>
    design(
      {
        random: input.random,
        timeZone: input.timeZone,
        date: shiftJournalDate(input.today, -daysAgo),
      },
      input,
    ),
  );
