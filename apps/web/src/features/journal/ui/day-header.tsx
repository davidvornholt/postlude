/**
 * The top of a day: how far it is from today, the date itself, and the
 * controls that move to another day, all on one line with the date.
 *
 * The date is the way to any other day. Pressed, it opens the calendar
 * popover; before the page has hydrated it is a link to the full calendar,
 * which works without a script. Beside it, the arrows step a day at a time.
 * They line up with the date's first line, so a long date that wraps on a
 * narrow screen never moves them under a pointer. On any day but today, the
 * line above the date offers the way back to it.
 */

import {
  type RefObject,
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { ActionAnchor } from '#/shared/ui/action.tsx';
import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import { journalMonthOf } from '../calendar.ts';
import type { CopyableJournalDay } from '../day-copy-markdown.ts';
import { journalDateLabel, journalDayRelation } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { CopyDayControl } from './copy-day-control.tsx';
import { DayLink } from './day-link.tsx';
import { DayPicker, type ReadWrittenDays } from './day-picker.tsx';
import { JournalIcon } from './journal-icons.tsx';

const subscribeToNothing = () => () => undefined;

/** False while the server's markup is all there is, true once React runs. */
const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

const dateClass = 'font-display text-4xl text-ink leading-tight sm:text-5xl';

const DateTrigger = ({
  date,
  open,
  pickerId,
  triggerRef,
  onToggle,
}: {
  readonly date: JournalDate;
  readonly open: boolean;
  readonly pickerId: string;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly onToggle: () => void;
}) => {
  const hydrated = useHydrated();
  const label = journalDateLabel(date);
  if (!hydrated) {
    return (
      <ActionAnchor
        className={`${dateClass} text-left`}
        href={`/calendar?month=${journalMonthOf(date)}&day=${date}`}
        variant="plain"
      >
        {label}
      </ActionAnchor>
    );
  }
  return (
    <button
      aria-controls={open ? pickerId : undefined}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={`group text-left ${dateClass} ${focusRingClass}`}
      onClick={onToggle}
      ref={triggerRef}
      title="Choose a day"
      type="button"
    >
      {label}
      <JournalIcon
        className={[
          'ml-2 inline size-6 align-middle text-ink-muted transition-[rotate,color] duration-200 ease-standard group-hover:text-ink motion-reduce:transition-none sm:size-7',
          open ? 'rotate-180' : '',
        ].join(' ')}
        name="expand"
      />
    </button>
  );
};

type DayHeaderProps = {
  readonly date: JournalDate;
  readonly today: JournalDate;
  readonly previous: JournalDate | undefined;
  readonly next: JournalDate | undefined;
  readonly copyDay: CopyableJournalDay;
  readonly readWrittenDays: ReadWrittenDays;
  readonly onChoose: (date: JournalDate) => void;
};

export const DayHeader = ({
  date,
  today,
  previous,
  next,
  copyDay,
  readWrittenDays,
  onChoose,
}: DayHeaderProps) => {
  const headingId = useId();
  const pickerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);
  const choose = (chosen: JournalDate) => {
    setOpen(false);
    if (chosen === date) {
      triggerRef.current?.focus();
      return;
    }
    onChoose(chosen);
  };

  return (
    <PageFrame
      as="header"
      className="relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 pt-2 pb-8 sm:pt-6"
    >
      <p className="col-start-1 row-start-1 flex flex-wrap items-baseline gap-x-2 text-ink-muted text-sm">
        <span>{journalDayRelation(date, today)}</span>
        {date === today ? null : (
          <>
            <span aria-hidden="true">·</span>
            {/* Its underline sits below the line, and takes no room there. */}
            <DayLink
              className="-mb-1"
              date={today}
              from={date}
              today={today}
              variant="quiet"
            >
              Go to today
            </DayLink>
          </>
        )}
      </p>
      <h1
        aria-atomic="true"
        aria-live="polite"
        className="col-span-2 row-start-2 text-balance sm:col-span-1"
        id={headingId}
      >
        <DateTrigger
          date={date}
          onToggle={() => setOpen((isOpen) => !isOpen)}
          open={open}
          pickerId={pickerId}
          triggerRef={triggerRef}
        />
      </h1>
      {/* Beside the date, the 2.75rem arrows are centred on its first line,
          which is 3.75rem tall. */}
      <div className="col-start-2 row-start-1 -mr-3 flex items-center sm:row-start-2 sm:mt-2 sm:self-start">
        <nav aria-label="Nearby days" className="flex items-center">
          {previous === undefined ? (
            <span className="size-11" />
          ) : (
            <DayLink
              aria-describedby={headingId}
              aria-keyshortcuts="ArrowLeft"
              data-focus-key="previous-day"
              date={previous}
              from={date}
              label="Previous day"
              title="Previous day (←)"
              today={today}
              variant="icon"
            >
              <JournalIcon name="previous" />
            </DayLink>
          )}
          {next === undefined ? (
            <span className="size-11" />
          ) : (
            <DayLink
              aria-describedby={headingId}
              aria-keyshortcuts="ArrowRight"
              data-focus-key="next-day"
              date={next}
              from={date}
              label="Next day"
              title="Next day (→)"
              today={today}
              variant="icon"
            >
              <JournalIcon name="next" />
            </DayLink>
          )}
        </nav>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <CopyDayControl day={copyDay} />
      </div>
      {open ? (
        <DayPicker
          id={pickerId}
          onChoose={choose}
          onClose={close}
          readWrittenDays={readWrittenDays}
          selected={date}
          today={today}
          trigger={triggerRef}
        />
      ) : null}
    </PageFrame>
  );
};
