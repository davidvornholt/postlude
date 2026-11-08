/**
 * The calendar that opens from a day's date: one month at a time, the day in
 * view marked, the days that hold writing dotted, and today outlined.
 *
 * It is a popover rather than a modal. Nothing behind it is blocked, so a
 * press anywhere else or focus moving past it closes it, and Escape closes it
 * with focus back on the date it opened from. The month is a grid in the
 * sense assistive technology knows: one day takes focus at a time and the keys
 * in `day-picker-keys.ts` move it.
 */

import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { Button } from '#/shared/ui/action.tsx';
import { ActionLink } from '#/shared/ui/action-link.tsx';
import { focusRingClass } from '#/shared/ui/design-classes.ts';
import {
  calendarWeeks,
  type JournalMonth,
  journalMonthLabel,
  journalMonthOf,
} from '../calendar.ts';
import { journalDateLabel } from '../day-label.ts';
import { dayPickerTarget, stepJournalMonth } from '../day-picker-keys.ts';
import type { JournalDate } from '../journal-day.ts';
import { JournalIcon } from './journal-icons.tsx';

const weekdays = [
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
  ['Su', 'Sunday'],
] as const;

export type ReadWrittenDays = (
  month: JournalMonth,
) => Promise<ReadonlyArray<JournalDate>>;

/**
 * The written days of each month the popover has shown, read once a month is
 * in view. A month that cannot be read shows no dots rather than an error: the
 * dots are a hint, and every day stays one press away either way.
 */
const useWrittenDays = (
  month: JournalMonth,
  read: ReadWrittenDays,
): ReadonlySet<JournalDate> => {
  const [written, setWritten] = useState<
    ReadonlyMap<JournalMonth, ReadonlySet<JournalDate>>
  >(new Map());
  const known = written.has(month);
  useEffect(() => {
    if (known) {
      return;
    }
    let current = true;
    read(month).then(
      (dates) => {
        if (current) {
          setWritten((months) => new Map(months).set(month, new Set(dates)));
        }
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [known, month, read]);
  return written.get(month) ?? new Set();
};

const dayButtonClass = (selected: boolean, today: boolean): string =>
  [
    'relative flex h-11 w-full items-center justify-center border text-sm tabular-nums',
    'transition-colors duration-150 ease-standard motion-reduce:transition-none',
    selected
      ? 'border-ink bg-ink font-semibold text-background'
      : 'text-ink hover:bg-surface-sunken active:bg-surface-sunken',
    !selected && today ? 'border-border-strong font-semibold' : '',
    selected || today ? '' : 'border-transparent',
    focusRingClass,
  ].join(' ');

const DayCell = ({
  date,
  focused,
  selected,
  today,
  written,
  onChoose,
}: {
  readonly date: JournalDate;
  readonly focused: boolean;
  readonly selected: boolean;
  readonly today: boolean;
  readonly written: boolean;
  readonly onChoose: (date: JournalDate) => void;
}) => (
  // biome-ignore lint/a11y/useAriaPropsSupportedByRole: in a grid this cell is a gridcell, which is where the ARIA date picker says the chosen day is; Biome reads it as a plain table cell.
  <td aria-selected={selected} className="p-0">
    <button
      aria-current={today ? 'date' : undefined}
      aria-label={`${journalDateLabel(date)}${written ? ', written' : ''}`}
      className={dayButtonClass(selected, today)}
      data-date={date}
      onClick={() => onChoose(date)}
      tabIndex={focused ? 0 : -1}
      type="button"
    >
      {Number(date.slice(-2))}
      {written ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"
        />
      ) : null}
    </button>
  </td>
);

/**
 * A press anywhere else, or focus moving past it, closes the popover and
 * leaves focus where it went. Escape closes it too, with focus back on the
 * date.
 */
const useDismissal = (
  popoverRef: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
  onClose: (returnFocus: boolean) => void,
): void => {
  useEffect(() => {
    const outside = (target: EventTarget | null): boolean =>
      target instanceof Node &&
      !popoverRef.current?.contains(target) &&
      !trigger.current?.contains(target);
    const leave = ({ target }: Event) => {
      if (outside(target)) {
        onClose(false);
      }
    };
    const pressEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !outside(event.target)) {
        event.preventDefault();
        onClose(true);
      }
    };
    document.addEventListener('pointerdown', leave, { capture: true });
    document.addEventListener('focusin', leave);
    document.addEventListener('keydown', pressEscape);
    return () => {
      document.removeEventListener('pointerdown', leave, { capture: true });
      document.removeEventListener('focusin', leave);
      document.removeEventListener('keydown', pressEscape);
    };
  }, [onClose, popoverRef, trigger]);
};

const MonthGrid = ({
  month,
  monthId,
  focused,
  selected,
  today,
  written,
  onChoose,
  onKeyDown,
}: {
  readonly month: JournalMonth;
  readonly monthId: string;
  readonly focused: JournalDate;
  readonly selected: JournalDate;
  readonly today: JournalDate;
  readonly written: ReadonlySet<JournalDate>;
  readonly onChoose: (date: JournalDate) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLTableElement>) => void;
}) => (
  <table
    aria-labelledby={monthId}
    className="mt-1 w-full table-fixed border-collapse"
    onKeyDown={onKeyDown}
    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the month is a grid in the ARIA date picker pattern, where one day takes focus and the arrow keys move it; a plain table would not say so.
    role="grid"
  >
    <thead>
      <tr>
        {weekdays.map(([short, name]) => (
          <th
            abbr={name}
            className="h-8 font-normal text-ink-muted text-xs"
            key={name}
            scope="col"
          >
            {short}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {calendarWeeks(month).map((days) => (
        <tr key={days.find((day) => day !== undefined)}>
          {days.map((date, column) =>
            date === undefined ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: an empty cell has no date, and its column is what tells it apart.
              <td key={column} />
            ) : (
              <DayCell
                date={date}
                focused={date === focused}
                key={date}
                onChoose={onChoose}
                selected={date === selected}
                today={date === today}
                written={written.has(date)}
              />
            ),
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

type DayPickerProps = {
  readonly id: string;
  readonly selected: JournalDate;
  readonly today: JournalDate;
  readonly readWrittenDays: ReadWrittenDays;
  readonly trigger: RefObject<HTMLElement | null>;
  readonly onChoose: (date: JournalDate) => void;
  /** Closes the popover, with focus going back to the date when it asks. */
  readonly onClose: (returnFocus: boolean) => void;
};

export const DayPicker = ({
  id,
  selected,
  today,
  readWrittenDays,
  trigger,
  onChoose,
  onClose,
}: DayPickerProps) => {
  const monthId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(selected);
  // Focus follows the day in hand only when a key moved it there, so stepping
  // the month with its buttons leaves focus on the button that was pressed.
  const [follow, setFollow] = useState(true);
  const month = journalMonthOf(focused);
  const written = useWrittenDays(month, readWrittenDays);

  useEffect(() => {
    if (!follow) {
      return;
    }
    popoverRef.current
      ?.querySelector<HTMLButtonElement>(
        `button[data-date="${CSS.escape(focused)}"]`,
      )
      ?.focus();
  }, [focused, follow]);

  useDismissal(popoverRef, trigger, onClose);

  const moveMonth = (months: number) => {
    setFollow(false);
    setFocused((date) => stepJournalMonth(date, months));
  };

  const pressInGrid = (event: KeyboardEvent<HTMLTableElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const target = dayPickerTarget(event.key, event.shiftKey, focused);
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    setFollow(true);
    setFocused(target);
  };

  return (
    <div
      aria-label="Choose a day"
      className={[
        'absolute inset-x-5 top-full z-40 mt-3 border border-border-strong bg-background p-3 sm:right-auto sm:left-8 sm:w-88',
        'transition-[opacity,translate] duration-200 ease-standard motion-reduce:transition-none',
        'starting:-translate-y-1 starting:opacity-0',
      ].join(' ')}
      id={id}
      ref={popoverRef}
      role="dialog"
    >
      <div className="flex items-center justify-between">
        <Button
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
          variant="icon"
        >
          <JournalIcon name="previous" />
        </Button>
        <h2
          aria-live="polite"
          className="font-display text-ink text-lg"
          id={monthId}
        >
          {journalMonthLabel(month)}
        </h2>
        <Button
          aria-label="Next month"
          onClick={() => moveMonth(1)}
          variant="icon"
        >
          <JournalIcon name="next" />
        </Button>
      </div>
      <MonthGrid
        focused={focused}
        month={month}
        monthId={monthId}
        onChoose={onChoose}
        onKeyDown={pressInGrid}
        selected={selected}
        today={today}
        written={written}
      />
      <div className="mt-3 flex min-h-11 items-center justify-between border-border border-t pt-2">
        <Button
          disabled={selected === today}
          onClick={() => onChoose(today)}
          variant="quiet"
          className="disabled:invisible"
        >
          Go to today
        </Button>
        <ActionLink search={{ month }} to="/calendar" variant="quiet">
          Open the calendar
        </ActionLink>
      </div>
    </div>
  );
};
