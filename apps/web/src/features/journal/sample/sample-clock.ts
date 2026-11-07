/**
 * Instants for a time on a sample day, read off the journal zone's wall clock,
 * so a made-up day was written, rated and measured on the day it is about,
 * whatever the zone's offset was then.
 */

import { journalDateWeekday, parseJournalDate } from '../journal-day.ts';

const millisecondsPerMinute = 60_000;
const minutesPerHour = 60;
const offsetDigits = 2;
/** As `journalDateWeekday` numbers them. */
const sunday = 0;
const saturday = 6;

export const isWeekend = (date: string): boolean => {
  const weekday = journalDateWeekday(date);
  return weekday === sunday || weekday === saturday;
};

/** How far the zone's wall clock is ahead of UTC at an instant, in minutes. */
const offsetMinutesAt = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
  );
  const instantMinute =
    Math.floor(instant.getTime() / millisecondsPerMinute) *
    millisecondsPerMinute;
  return (wall - instantMinute) / millisecondsPerMinute;
};

const wallMilliseconds = (date: string, hour: number, minute: number) => {
  const { year, month, day } = parseJournalDate(date);
  return Date.UTC(year, month - 1, day, hour, minute);
};

/**
 * The instant the zone's clock reads `hour:minute` on `date`. The offset is
 * looked up twice, at a first guess and then at the instant it gives, which is
 * exact for every time that isn't skipped by a change to summer time.
 */
export const instantAt = (
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date => {
  const wall = wallMilliseconds(date, hour, minute);
  const guess =
    wall - offsetMinutesAt(new Date(wall), timeZone) * millisecondsPerMinute;
  return new Date(
    wall - offsetMinutesAt(new Date(guess), timeZone) * millisecondsPerMinute,
  );
};

const pad = (value: number) => String(value).padStart(offsetDigits, '0');

/** `hour:minute` on `date` as an ISO instant with the zone's offset, as /wrap writes one. */
export const isoAt = (
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): string => {
  const offset = offsetMinutesAt(
    instantAt(date, hour, minute, timeZone),
    timeZone,
  );
  const sign = offset < 0 ? '-' : '+';
  const size = Math.abs(offset);
  return `${date}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.floor(size / minutesPerHour))}:${pad(size % minutesPerHour)}`;
};
