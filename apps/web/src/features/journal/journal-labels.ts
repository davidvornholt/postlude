/** Reader-facing labels whose convention belongs to the journal, not the device. */

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const numberFormat = new Intl.NumberFormat('en-US');
const one = 1;

export const journalMonthLabel = (month: number): string =>
  monthNames[month - 1] ?? '';

export const journalWeekdayLabel = (weekday: number): string =>
  weekdayNames[weekday] ?? '';

export const journalNumberLabel = (value: number): string =>
  numberFormat.format(value);

export const journalCountLabel = (count: number, unit: string): string =>
  `${journalNumberLabel(count)} ${unit}${count === one ? '' : 's'}`;
