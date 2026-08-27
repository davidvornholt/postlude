/**
 * Which journal day an instant belongs to.
 *
 * A journal day runs 04:00 to 04:00, so an entry written at half past one in
 * the morning still closes out the evening before rather than opening a day the
 * writer has not lived yet. Everything downstream — the row key, the streaks,
 * the heatmap — is keyed by the calendar date this returns.
 *
 * The rule is applied to wall-clock time in one configured zone, not to the
 * instant. Reading the zone's clock and stepping the calendar date back when it
 * reads before 04:00 is exact on the two days a year the offset moves: shifting
 * the instant by four hours instead would put the boundary an hour off, because
 * the offset at the shifted instant is not the offset at the original one.
 *
 * The zone is configuration rather than the device's own, so the same evening is
 * one journal day from every device, and a trip abroad does not split a night in
 * two or hide the day just written. See `JOURNAL_TIME_ZONE` in
 * `apps/web/README.md`.
 */

/** A Common Era calendar date as `YYYY-MM-DD`, from 0001 through 9999. */
export type JournalDate = string;

const dayStartsAtHour = 4;
const monthsPerYear = 12;
const firstJournalYear = 1;
const lastJournalYear = 9999;
const yearDigits = 4;
const monthAndDayDigits = 2;

type CalendarDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

/** Four-digit years keep text ordering identical to calendar ordering. */
export const formatJournalDate = ({
  year,
  month,
  day,
}: CalendarDate): string => {
  if (year < firstJournalYear || year > lastJournalYear) {
    throw new RangeError(`Journal year is outside 0001 through 9999: ${year}`);
  }
  return `${pad(year, yearDigits)}-${pad(month, monthAndDayDigits)}-${pad(day, monthAndDayDigits)}`;
};

/** The first day representable by the journal and its PostgreSQL DATE key. */
export const earliestJournalDate = formatJournalDate({
  year: firstJournalYear,
  month: 1,
  day: 1,
});

/** `setUTCFullYear` preserves years below 0100 instead of adding 1900. */
const daysInMonth = (year: number, month: number): number => {
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(year, month, 0);
  return lastDay.getUTCDate();
};

/**
 * The calendar date `days` before or after this one, as arithmetic on the date
 * itself. It never builds an instant from the date, so it cannot pick up a zone
 * or a daylight-saving jump on the way: the day before the clocks go forward is
 * still the day before.
 */
export const shiftJournalDate = (
  date: JournalDate,
  days: number,
): JournalDate => {
  const { year, month, day } = parseJournalDate(date);
  let y = year;
  let m = month;
  let d = day + days;

  while (d < 1) {
    m -= 1;
    if (m < 1) {
      m = monthsPerYear;
      y -= 1;
    }
    d += daysInMonth(y, m);
  }
  for (;;) {
    const length = daysInMonth(y, m);
    if (d <= length) {
      return formatJournalDate({ year: y, month: m, day: d });
    }
    d -= length;
    m += 1;
    if (m > monthsPerYear) {
      m = 1;
      y += 1;
    }
  }
};

const journalDatePattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;

/** Whether the text is a calendar date this module will accept. */
export const isJournalDate = (text: string): boolean => {
  const parts = journalDatePattern.exec(text)?.groups;
  if (parts === undefined) {
    return false;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  return (
    year >= firstJournalYear &&
    year <= lastJournalYear &&
    month >= 1 &&
    month <= monthsPerYear &&
    Number(parts.day) >= 1 &&
    Number(parts.day) <= daysInMonth(year, month)
  );
};

/** Splits a validated journal date into its calendar parts. */
export const parseJournalDate = (date: JournalDate): CalendarDate => {
  const parts = journalDatePattern.exec(date)?.groups;
  if (parts === undefined || !isJournalDate(date)) {
    throw new TypeError(`Not a calendar date: ${date}`);
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
};

/**
 * How many days lie between two calendar dates, negative when the second comes
 * first. Both are read as noon UTC rather than midnight, so a rounding error
 * could not push a difference across a day boundary.
 */
export const daysBetweenJournalDates = (
  from: JournalDate,
  to: JournalDate,
): number => {
  const noonHour = 12;
  const millisecondsPerDay = 86_400_000;
  const noon = ({ year, month, day }: CalendarDate): number => {
    const instant = new Date(0);
    instant.setUTCFullYear(year, month - 1, day);
    instant.setUTCHours(noonHour, 0, 0, 0);
    return instant.getTime();
  };
  return Math.round(
    (noon(parseJournalDate(to)) - noon(parseJournalDate(from))) /
      millisecondsPerDay,
  );
};

/**
 * Which day of the week a calendar date falls on, 0 for Sunday through 6 for
 * Saturday. Built at noon UTC from the date's own parts, like every other
 * reading here, so the answer is a property of the date rather than of the zone
 * the question was asked in.
 */
export const journalDateWeekday = (date: JournalDate): number => {
  const noonHour = 12;
  const { year, month, day } = parseJournalDate(date);
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(noonHour, 0, 0, 0);
  return instant.getUTCDay();
};

/**
 * The zone's wall clock at an instant. `en-CA` is asked for so the parts come
 * back as plain numerals whatever the reader's own locale is, and `h23` so
 * midnight reads as hour 0 rather than as hour 24 of the day before.
 */
const wallClock = (
  instant: Date,
  timeZone: string,
): CalendarDate & { readonly hour: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
  };
};

/** The journal day an instant falls in, as the zone's clock reads it. */
export const journalDateAt = (instant: Date, timeZone: string): JournalDate => {
  const { hour, ...date } = wallClock(instant, timeZone);
  const calendarDate = formatJournalDate(date);
  return hour < dayStartsAtHour
    ? shiftJournalDate(calendarDate, -1)
    : calendarDate;
};
