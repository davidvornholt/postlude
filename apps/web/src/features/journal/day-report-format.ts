/**
 * How a day report document's values read: minutes as hours and minutes, and
 * instants as the clock time /wrap wrote them in.
 *
 * An instant keeps the offset of the place the day was lived in, so its clock
 * time is read from the instant as written, not converted to the zone of
 * whoever reads the report, and the server and the browser agree on it.
 */

const minutesPerHour = 60;

/** Whole minutes as "45 min", "2 h", or "2 h 5 min". */
export const minutesText = (minutes: number): string => {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / minutesPerHour);
  const rest = whole % minutesPerHour;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

const clockPattern = /T(?<hour>\d{2}):(?<minute>\d{2})/u;

/** The clock time of an ISO instant as written, such as "09:05". */
export const clockOf = (instant: string): string => {
  const groups = clockPattern.exec(instant)?.groups;
  return groups === undefined ? '–' : `${groups.hour}:${groups.minute}`;
};

export const clockRange = (start: string, end: string): string =>
  `${clockOf(start)}–${clockOf(end)}`;

const offsetPattern = /(?<offset>Z|[+-]\d{2}:\d{2})$/u;
const millisecondsPerMinute = 60_000;

/**
 * Minutes east of UTC in an instant's offset, so a clock time can be worked
 * out for any moment near it, such as an hour on the timeline's axis.
 */
export const offsetMinutesOf = (instant: string): number => {
  const offset = offsetPattern.exec(instant)?.groups?.offset;
  if (offset === undefined || offset === 'Z') {
    return 0;
  }
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  return sign * ((hours ?? 0) * minutesPerHour + (minutes ?? 0));
};

const hoursPerDay = 24;
const clockDigits = 2;

/** The clock time of a moment, in milliseconds, at an offset in minutes. */
export const clockAt = (ms: number, offsetMinutes: number): string => {
  const local = Math.floor(ms / millisecondsPerMinute) + offsetMinutes;
  const minuteOfDay =
    ((local % (hoursPerDay * minutesPerHour)) + hoursPerDay * minutesPerHour) %
    (hoursPerDay * minutesPerHour);
  const hour = Math.floor(minuteOfDay / minutesPerHour);
  const minute = minuteOfDay % minutesPerHour;
  return `${String(hour).padStart(clockDigits, '0')}:${String(minute).padStart(clockDigits, '0')}`;
};

export const minutesBetween = (start: string, end: string): number =>
  Math.round((Date.parse(end) - Date.parse(start)) / millisecondsPerMinute);

const pad = (value: number): string => String(value).padStart(clockDigits, '0');

/**
 * A moment, in milliseconds, as an ISO instant to the minute at an offset in
 * minutes, the way /wrap writes one: "2026-10-29T09:05:00+01:00".
 */
export const isoInstantAt = (ms: number, offsetMinutes: number): string => {
  const minute = Math.floor(ms / millisecondsPerMinute) * millisecondsPerMinute;
  const local = new Date(minute + offsetMinutes * millisecondsPerMinute);
  const size = Math.abs(offsetMinutes);
  const sign = offsetMinutes < 0 ? '-' : '+';
  return [
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00`,
    `${sign}${pad(Math.floor(size / minutesPerHour))}:${pad(size % minutesPerHour)}`,
  ].join('');
};
