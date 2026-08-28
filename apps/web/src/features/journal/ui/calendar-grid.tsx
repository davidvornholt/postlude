import { Link } from '@tanstack/react-router';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import {
  calendarWeekdayIndex,
  datesInMonth,
  type JournalMonth,
} from '../calendar.ts';
import type { JournalDate } from '../journal-day.ts';
import type { CalendarDay } from '../services/calendar-fns.ts';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const weekLength = weekdays.length;

const rowsOf = (
  month: JournalMonth,
): ReadonlyArray<ReadonlyArray<JournalDate | undefined>> => {
  const dates = datesInMonth(month);
  const leading = new Array<undefined>(
    calendarWeekdayIndex(dates[0] ?? `${month}-01`),
  ).fill(undefined);
  const cells: Array<JournalDate | undefined> = [...leading, ...dates];
  while (cells.length % weekLength !== 0) {
    cells.push(undefined);
  }
  return Array.from({ length: cells.length / weekLength }, (_unused, index) =>
    cells.slice(index * weekLength, (index + 1) * weekLength),
  );
};

const dayLinkClass = [
  'group relative flex min-h-16 w-full flex-col px-2 py-2 text-left sm:min-h-24 sm:px-3',
  'transition-colors duration-150 ease-standard hover:bg-surface active:bg-surface',
  focusRingClass,
].join(' ');

const CalendarPaddingCell = () => (
  <td
    aria-hidden="true"
    className="border-border border-x align-top"
    data-calendar-padding="true"
  >
    <span className="block min-h-16 sm:min-h-24" />
  </td>
);

const CalendarCell = ({
  date,
  entry,
  month,
  selected,
  today,
}: {
  readonly date: JournalDate;
  readonly entry: CalendarDay | undefined;
  readonly month: JournalMonth;
  readonly selected: JournalDate;
  readonly today: JournalDate;
}) => {
  const hasEntry = entry !== undefined;
  const future = date > today;
  if (future) {
    return (
      <td className="border-border border-x align-top">
        <span className="flex min-h-16 px-2 py-2 text-ink-faint sm:min-h-24 sm:px-3">
          {Number(date.slice(-2))}
        </span>
      </td>
    );
  }

  return (
    <td className="border-border border-x align-top">
      <Link
        aria-current={date === selected ? 'date' : undefined}
        aria-label={`${date}${date === today ? ', today' : ''}${hasEntry ? ', entry available' : ', no entry'}`}
        className={dayLinkClass}
        search={{ day: date, month }}
        to="/calendar"
      >
        <span
          className={[
            'tabular-nums',
            date === selected ? 'font-semibold text-ink' : 'text-ink-muted',
          ].join(' ')}
        >
          {Number(date.slice(-2))}
        </span>
        {hasEntry ? (
          <span className="mt-auto flex items-center gap-1.5 text-ink-faint text-xs">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            <span className="sr-only">Entry available</span>
          </span>
        ) : null}
        {date === selected ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-2 bottom-0 h-px bg-primary"
          />
        ) : null}
      </Link>
    </td>
  );
};

export const CalendarGrid = ({
  days,
  month,
  selected,
  today,
}: {
  readonly days: ReadonlyArray<CalendarDay>;
  readonly month: JournalMonth;
  readonly selected: JournalDate;
  readonly today: JournalDate;
}) => {
  const entries = new Map(days.map((day) => [day.date, day]));

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Days in this month</caption>
      <thead>
        <tr className="border-border border-y">
          {weekdays.map((weekday) => (
            <th
              className="px-1 py-3 text-center font-normal text-ink-muted text-sm"
              key={weekday}
              scope="col"
            >
              {weekday}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowsOf(month).map((week) => (
          <tr
            className="border-border border-b"
            key={week.find((date) => date !== undefined) ?? `leading-${month}`}
          >
            {weekdays.map((weekday) => {
              const date = week[weekdays.indexOf(weekday)];
              return date === undefined ? (
                <CalendarPaddingCell key={weekday} />
              ) : (
                <CalendarCell
                  date={date}
                  entry={entries.get(date)}
                  key={date}
                  month={month}
                  selected={selected}
                  today={today}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
