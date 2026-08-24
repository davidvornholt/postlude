/**
 * The archive sample both comparison themes render: a year of journal activity,
 * two streaks, and the entry from a year ago today.
 *
 * The year is generated rather than typed out, and generated from a fixed seed
 * with no clock and no `Math.random`, so both themes draw the same grid and a
 * screenshot taken today matches one taken next week. The run-and-gap shape
 * comes from a two-state walk: writing tends to continue, and a lapse tends to
 * last a few days — which is what real journal activity looks like, and what a
 * flat coin toss per day never produces.
 */

export type JournalDay = {
  readonly date: string;
  /** Words written that day; 0 is a day with no entry. */
  readonly words: number;
};

export type HeatLevel = 'none' | 'q1' | 'q2' | 'q3' | 'q4';
export type Quartiles = readonly [number, number, number];

const lehmerMultiplier = 48_271;
/** 2^31 − 1, prime, so the sequence visits every state before repeating. */
const lehmerModulus = 2_147_483_647;
const lehmerStates = lehmerModulus - 1;

/**
 * A Lehmer generator: one multiplication and one remainder per draw, every
 * value derived from the last, nothing read from the clock or the platform.
 * Both operands stay well inside the exact integer range, so it produces the
 * same sequence on any engine — which is the whole point of seeding it.
 */
const randomFrom = (seed: number) => {
  let state = (Math.abs(Math.trunc(seed)) % lehmerStates) + 1;
  return (): number => {
    state = (state * lehmerMultiplier) % lehmerModulus;
    return (state - 1) / lehmerStates;
  };
};

export const heatmapSeed = 20_260_822;

/** Sunday 17 August 2025 — the grid starts on a Sunday so weeks are columns. */
const startYear = 2025;
const startMonthIndex = 7;
const startDayOfMonth = 17;
const daysPerWeek = 7;
const weekCount = 53;
const dayInMilliseconds = 86_400_000;
const isoDateLength = 10;

export const heatmapDayCount = weekCount * daysPerWeek;

const firstDayUtc = Date.UTC(startYear, startMonthIndex, startDayOfMonth);

const dateAt = (index: number): string =>
  new Date(firstDayUtc + index * dayInMilliseconds)
    .toISOString()
    .slice(0, isoDateLength);

const continueChance = 0.72;
const returnChance = 0.3;
const minimumWords = 80;
const maximumWords = 900;

/** The current run, which the tail of the grid has to agree with. */
export const journalStreakDays = 23;
export const scriptureStreakDays = 9;

export const generateHeatmapDays = (
  seed: number,
): ReadonlyArray<JournalDay> => {
  const random = randomFrom(seed);
  const written: Array<boolean> = [];
  let writing = true;

  for (let index = 0; index < heatmapDayCount; index += 1) {
    writing = random() < (writing ? continueChance : returnChance);
    written.push(writing);
  }

  // The streak the archive states in words is the same run the grid ends on,
  // and it has to start somewhere: the day before it is the last blank.
  const streakStart = heatmapDayCount - journalStreakDays;
  written.fill(true, streakStart);
  written[streakStart - 1] = false;

  const wordSpread = maximumWords - minimumWords + 1;
  return written.map((wroteToday, index) => ({
    date: dateAt(index),
    words: wroteToday ? minimumWords + Math.floor(random() * wordSpread) : 0,
  }));
};

export const heatmapDays = generateHeatmapDays(heatmapSeed);

export const writtenDays = (
  days: ReadonlyArray<JournalDay>,
): ReadonlyArray<JournalDay> => days.filter((day) => day.words > 0);

const firstQuartileFraction = 0.25;
const medianFraction = 0.5;
const thirdQuartileFraction = 0.75;
const quartileFractions = [
  firstQuartileFraction,
  medianFraction,
  thirdQuartileFraction,
] as const;

/**
 * The word counts that split the written days into four equal-sized groups, by
 * nearest rank. Bucketing on the days that exist rather than on a fixed word
 * scale is what keeps the darkest cells rare in a quiet year and common in a
 * heavy one.
 */
export const quartiles = (days: ReadonlyArray<JournalDay>): Quartiles => {
  const counts = [...writtenDays(days).map((day) => day.words)].sort(
    (first, second) => first - second,
  );
  const rankOf = (fraction: number) =>
    counts[Math.max(Math.ceil(fraction * counts.length) - 1, 0)] ?? 0;
  return [
    rankOf(quartileFractions[0]),
    rankOf(quartileFractions[1]),
    rankOf(quartileFractions[2]),
  ];
};

/** Which step of the ramp a day sits on. Boundaries fall to the lower step. */
export const heatLevel = (words: number, thresholds: Quartiles): HeatLevel => {
  if (words <= 0) {
    return 'none';
  }
  if (words <= thresholds[0]) {
    return 'q1';
  }
  if (words <= thresholds[1]) {
    return 'q2';
  }
  return words <= thresholds[2] ? 'q3' : 'q4';
};

export const archiveSample = {
  days: heatmapDays,
  journalStreakDays,
  scriptureStreakDays,
  onThisDay: {
    dateLabel: '22 August 2025',
    snippet:
      'Moved the desk under the window so the morning light lands on the left page. Slept badly, wrote anyway.',
  },
} as const;
