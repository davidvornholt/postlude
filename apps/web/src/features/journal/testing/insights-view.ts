/**
 * Made-up journals for the Insights page, for tests and fixtures only. Nothing
 * here is anyone's writing: the days carry counts, ratings and day metrics,
 * and no text.
 *
 * The hand-made week and month hold every case the page has to tell apart: a
 * change of metrics version, a day without a report, numbers that were not
 * measured, days without a rating, and days still to come. The generated
 * journal spans years, for the year map and the month grid.
 *
 * It is generated without a clock and without `Math.random`, so a test asserts
 * against the same journal every time it runs. The run-and-gap shape comes from
 * a two-state walk — writing tends to continue and a lapse tends to last a few
 * days — because a flat coin toss per day produces neither a streak nor an
 * empty week, which are two of the things the page exists to show.
 *
 * Views are assembled by the functions the server function uses, so a test
 * renders a consistent page rather than one whose streaks disagree with its map.
 */

import type { ActivityDay } from '../activity.ts';
import { calendarWeekdayIndex } from '../calendar.ts';
import { categoryTotals, comparableDays, measuresOf } from '../day-measures.ts';
import { type InsightsRange, rangeDates } from '../insights-range.ts';
import type { InsightsDay, InsightsView } from '../insights-view.ts';
import { type JournalDate, shiftJournalDate } from '../journal-day.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { journalStreak, scriptureStreak } from '../streaks.ts';
import { sampleDayMetrics } from './evening-view.ts';

/** A day as a fixture writes it: with the full report the server cuts down. */
export type SampleDay = Omit<InsightsDay, 'metrics'> & {
  readonly report: DayMetrics | null;
};

export const blankDay = (date: JournalDate): SampleDay => ({
  date,
  journalWords: 0,
  scriptureWords: 0,
  hasScripture: false,
  scriptureBook: null,
  energy: null,
  progress: null,
  repeatDay: null,
  closed: false,
  report: null,
});

const insightsDayOf = ({ report, ...day }: SampleDay): InsightsDay => ({
  ...day,
  metrics: report === null ? null : measuresOf(report),
});

/** A day with nothing stored, as the page receives it. */
export const unratedDay = (date: JournalDate): InsightsDay =>
  insightsDayOf(blankDay(date));

const measured = (
  date: string,
  changes: Partial<DayMetrics> = {},
): DayMetrics => ({ ...sampleDayMetrics(date), ...changes });

const isWritten = (day: SampleDay): boolean =>
  day.journalWords + day.scriptureWords > 0 || day.hasScripture;

/** Insights opens on the first day with writing, a rating or a report. */
const isStored = (day: SampleDay): boolean =>
  isWritten(day) ||
  day.energy !== null ||
  day.progress !== null ||
  day.repeatDay !== null ||
  day.report !== null;

const historyOf = (
  journal: ReadonlyArray<SampleDay>,
): ReadonlyArray<ActivityDay> =>
  journal.filter(isWritten).map((day) => ({
    date: day.date,
    journalWords: day.journalWords,
    scriptureWords: day.scriptureWords,
    hasScripture: day.hasScripture,
    journalWrittenOnTheDay: true,
    scriptureUsedOnTheDay: true,
  }));

/** The range that holds the whole of this journal up to today. */
export const allTimeOf = (
  journal: ReadonlyArray<SampleDay>,
  today: JournalDate,
): InsightsRange => ({
  kind: 'all',
  from: journal.find(isStored)?.date ?? today,
  to: today,
});

/** The view the server function would send for this journal and range. */
export const sampleInsightsView = (
  journal: ReadonlyArray<SampleDay>,
  range: InsightsRange,
  today: JournalDate,
): InsightsView => {
  const byDate = new Map(journal.map((day) => [day.date, day]));
  const days = rangeDates(range).map(
    (date) => byDate.get(date) ?? blankDay(date),
  );
  const earliest = journal.find(isStored)?.date;
  const history = historyOf(journal.filter((day) => day.date <= today));
  return {
    range,
    today,
    earliest,
    days: days.map(insightsDayOf),
    categories: categoryTotals(
      comparableDays(days.map((day) => ({ metrics: day.report }))),
    ),
    journalStreak: journalStreak(history, today),
    scriptureStreak: scriptureStreak(history, today),
    exportAvailable: journal.some(isWritten),
  };
};

const weekToday = '2026-10-30';

/** The week of October 26, 2026, as stored, looked at on its Friday. */
export const sampleWeekJournal: ReadonlyArray<SampleDay> = [
  {
    ...blankDay('2026-10-26'),
    journalWords: 640,
    scriptureWords: 90,
    hasScripture: true,
    scriptureBook: 'Psalms',
    energy: 'fresh',
    progress: 'a_lot',
    repeatDay: 'yes',
    closed: true,
    report: measured('2026-10-26', {
      metricsVersion: 1,
      activeMinutes: 380,
      focusMinutes: 250,
      scatteredMinutes: 130,
    }),
  },
  {
    ...blankDay('2026-10-27'),
    journalWords: 410,
    energy: 'okay',
    progress: 'solid',
    repeatDay: 'partly',
    closed: true,
    report: measured('2026-10-27'),
  },
  {
    ...blankDay('2026-10-28'),
    journalWords: 220,
    hasScripture: true,
    scriptureBook: 'John',
    energy: 'drained',
    progress: 'little',
    repeatDay: 'no',
    closed: true,
  },
  {
    ...blankDay('2026-10-29'),
    energy: 'okay',
    report: measured('2026-10-29', {
      activeMinutes: 505,
      focusMinutes: null,
      scatteredMinutes: null,
      sentMails: [
        { mailbox: 'Work', count: 2 },
        { mailbox: 'Home', count: null },
      ],
    }),
  },
  {
    ...blankDay('2026-10-30'),
    report: measured('2026-10-30', {
      activeMinutes: null,
      focusMinutes: null,
      scatteredMinutes: null,
    }),
  },
];

export const sampleInsightsWeek: InsightsView = sampleInsightsView(
  sampleWeekJournal,
  { kind: 'week', start: '2026-10-26' },
  weekToday,
);

const energies = ['fresh', 'okay', 'okay', 'drained'] as const;
const progresses = ['solid', 'a_lot', 'little', 'solid', 'solid'] as const;
const repeats = ['yes', 'partly', 'yes', 'no', 'partly', 'yes'] as const;
const books = [
  'Psalms',
  'John',
  'Romans',
  'Isaiah',
  'Mark',
  'Genesis',
] as const;
const minutesStep = 37;
const minutesSpread = 300;
const minutesFloor = 150;
const wordsStep = 53;
const wordsSpread = 700;
const wordsFloor = 120;
const reportEvery = 6;
const scriptureEvery = 3;
const saturdayIndex = 5;
const focusShare = 0.6;

const monthDay = (date: JournalDate, index: number): SampleDay => {
  const weekend = calendarWeekdayIndex(date) >= saturdayIndex;
  const active = minutesFloor + ((index * minutesStep) % minutesSpread);
  const focus = Math.round(active * focusShare);
  const book =
    index % scriptureEvery === 0 ? (books[index % books.length] ?? null) : null;
  return {
    ...blankDay(date),
    journalWords: weekend
      ? 0
      : wordsFloor + ((index * wordsStep) % wordsSpread),
    hasScripture: book !== null,
    scriptureBook: book,
    energy: weekend ? null : (energies[index % energies.length] ?? null),
    progress: weekend ? null : (progresses[index % progresses.length] ?? null),
    repeatDay: weekend ? null : (repeats[index % repeats.length] ?? null),
    closed: !weekend,
    report:
      index % reportEvery === reportEvery - 1
        ? null
        : measured(date, {
            activeMinutes: active,
            focusMinutes: focus,
            scatteredMinutes: active - focus,
          }),
  };
};

/**
 * October 2026 looked at on its 30th, in one metrics version, with every sixth
 * day missing its report and the weekends left unwritten and unrated.
 */
export const sampleMonthJournal: ReadonlyArray<SampleDay> = rangeDates({
  kind: 'month',
  month: '2026-10',
})
  .filter((date) => date <= weekToday)
  .map(monthDay);

export const sampleInsightsMonth: InsightsView = sampleInsightsView(
  sampleMonthJournal,
  { kind: 'month', month: '2026-10' },
  weekToday,
);

const lehmerMultiplier = 48_271;
/** 2^31 − 1, prime, so the sequence visits every state before repeating. */
const lehmerModulus = 2_147_483_647;
const lehmerStates = lehmerModulus - 1;

const randomFrom = (seed: number) => {
  let state = (Math.abs(Math.trunc(seed)) % lehmerStates) + 1;
  return (): number => {
    state = (state * lehmerMultiplier) % lehmerModulus;
    return (state - 1) / lehmerStates;
  };
};

const pick = <Item>(items: ReadonlyArray<Item>, random: () => number) =>
  items[Math.floor(random() * items.length)] ?? null;

const continueChance = 0.72;
const returnChance = 0.3;
const minimumWords = 80;
const wordSpread = 820;
const scriptureChance = 0.55;
const scriptureWords = 40;
const ratedChance = 0.85;
const reportChance = 0.8;

/** One generated day: written or not, and with whatever else the dice give it. */
const generatedDay = (
  date: JournalDate,
  writing: boolean,
  version: number,
  random: () => number,
): SampleDay => {
  const morning = writing && random() < scriptureChance;
  const rated = writing && random() < ratedChance;
  const active = minutesFloor + Math.floor(random() * minutesSpread);
  const focus = Math.round(active * focusShare);
  const report =
    random() < reportChance
      ? measured(date, {
          metricsVersion: version,
          activeMinutes: active,
          focusMinutes: focus,
          scatteredMinutes: active - focus,
        })
      : null;
  const words = minimumWords + Math.floor(random() * wordSpread);
  const ratings = rated
    ? {
        energy: pick(energies, random),
        progress: pick(progresses, random),
        repeatDay: pick(repeats, random),
        closed: true,
      }
    : {};
  return {
    ...blankDay(date),
    ...ratings,
    journalWords: writing ? words : 0,
    scriptureWords: morning ? scriptureWords : 0,
    hasScripture: morning,
    scriptureBook: morning ? pick(books, random) : null,
    report,
  };
};

/**
 * `dayCount` days ending on `today`, walked forwards. Written days are mostly
 * rated and mostly carry a report; the first half of the reports is measured
 * under metrics version 1 and the rest under version 2.
 */
export const sampleJournal = (
  today: JournalDate,
  dayCount: number,
  seed: number,
): ReadonlyArray<SampleDay> => {
  const random = randomFrom(seed);
  const days: Array<SampleDay> = [];
  let writing = true;
  for (let index = dayCount - 1; index >= 0; index -= 1) {
    writing = random() < (writing ? continueChance : returnChance);
    days.push(
      generatedDay(
        shiftJournalDate(today, -index),
        writing,
        index > dayCount / 2 ? 1 : 2,
        random,
      ),
    );
  }
  return days;
};
