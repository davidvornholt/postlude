/**
 * The clock of the pages /wrap stored before day reports were documents.
 *
 * Those pages wrote every time as a Berlin clock time, such as "09:30", on a
 * journal day that runs from 04:00 to 04:00. A converted report needs
 * instants, so a clock time is read back onto the day it belongs to: an hour
 * before four is the next calendar day, and an end that would come before its
 * start is a day later.
 */

import { isoInstantAt } from '../day-report-format.ts';

export const legacyTimeZone = 'Europe/Berlin';
const dayStartHour = 4;
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

const wallFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: legacyTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** How far Berlin's clock is ahead of UTC at a moment, in minutes. */
export const berlinOffsetAt = (ms: number): number => {
  const parts = wallFormat.formatToParts(new Date(ms));
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
  );
  return Math.round((wall - Math.floor(ms / minuteMs) * minuteMs) / minuteMs);
};

/** A moment as an instant to the nearest minute, with Berlin's offset then. */
export const berlinInstant = (ms: number): string => {
  const minute = Math.round(ms / minuteMs) * minuteMs;
  return isoInstantAt(minute, berlinOffsetAt(minute));
};

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: legacyTimeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** An instant as the Berlin clock time the old pages showed for it. */
export const berlinClock = (instant: string): string =>
  clockFormat.format(new Date(instant));

const clockPattern = /^(?<hour>\d{1,2}):(?<minute>\d{2})$/u;
const lastHour = 23;
const lastMinute = 59;

const clockParts = (
  clock: string,
): { readonly hour: number; readonly minute: number } | undefined => {
  const groups = clockPattern.exec(clock.trim())?.groups;
  const hour = Number(groups?.hour);
  const minute = Number(groups?.minute);
  return groups === undefined || hour > lastHour || minute > lastMinute
    ? undefined
    : { hour, minute };
};

/**
 * The moment, in milliseconds, a Berlin clock time names on a journal day.
 * The offset is looked up at a first guess and again at the moment it gives,
 * which is exact for every time a change to summer time doesn't skip.
 */
export const journalClockMs = (
  day: string,
  clock: string,
): number | undefined => {
  const parts = clockParts(clock);
  if (parts === undefined) {
    return undefined;
  }
  const calendarDay =
    Date.parse(`${day}T00:00:00Z`) + (parts.hour < dayStartHour ? dayMs : 0);
  const wall = calendarDay + parts.hour * hourMs + parts.minute * minuteMs;
  const guess = wall - berlinOffsetAt(wall) * minuteMs;
  return wall - berlinOffsetAt(guess) * minuteMs;
};

export type ClockSpan = { readonly start: string; readonly end: string };

const rangePattern =
  /^(?<start>\d{1,2}:\d{2})\s*[–-]\s*(?<end>\d{1,2}:\d{2})$/u;

/** A clock range such as "13:00–04:00" on a journal day, as instants. */
export const journalClockSpan = (
  day: string,
  range: string,
): ClockSpan | undefined => {
  const groups = rangePattern.exec(range.trim())?.groups;
  const start = journalClockMs(day, groups?.start ?? '');
  const end = journalClockMs(day, groups?.end ?? '');
  if (start === undefined || end === undefined) {
    return undefined;
  }
  return {
    start: berlinInstant(start),
    end: berlinInstant(end < start ? end + dayMs : end),
  };
};

export const journalClockInstant = (
  day: string,
  clock: string,
): string | undefined => {
  const ms = journalClockMs(day, clock);
  return ms === undefined ? undefined : berlinInstant(ms);
};

export const isClock = (text: string): boolean =>
  clockParts(text) !== undefined;

export const isClockRange = (text: string): boolean =>
  rangePattern.test(text.trim());
