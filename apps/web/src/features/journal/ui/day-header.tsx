/**
 * The top of a day: how far it is from today, the date itself, and the
 * controls that move to another day, all on one line with the date.
 *
 * The date is the way to any other day. Pressed, it opens the calendar
 * popover; before the page has hydrated it is a link to the full calendar,
 * which works without a script. Beside it, the arrows step a day at a time. On
 * any day but today, the line above the date offers the way back to it.
 *
 * From a tablet up, the date stays on one line beside the arrows. Its size
 * follows the room the arrows leave, so the longest date there is fits and
 * every other date is set at the same size, rather than each date choosing its
 * own. A phone has no room for that, so there the arrows move up beside the
 * line above, and the date breaks after the weekday on purpose.
 */

import { ChevronDown } from 'lucide-react';
import {
  type RefObject,
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import { journalMonthOf } from '../calendar.ts';
import type { CopyableJournalDay } from '../day-copy-markdown.ts';
import {
  journalDateLabel,
  journalDateLabelParts,
  journalDayRelation,
} from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { CopyDayControl } from './copy-day-control.tsx';
import { DayLink } from './day-link.tsx';
import { DayPicker, type ReadWrittenDays } from './day-picker.tsx';
import { StepGlyph, UnavailableStep } from './period-heading.tsx';

const subscribeToNothing = () => () => undefined;

/** False while the server's markup is all there is, true once React runs. */
const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

/*
 * The date's size is worked out from the width of the heading it sits in,
 * which is a size container for that reason. The divisors are the widths of the
 * longest text measured in Fraunces, with a little to spare: on a phone,
 * "September 30, 2026" is 9.4em, and the 2rem chevron follows it; from a
 * tablet up, "Wednesday, September 30, 2026" is 15.1em at most, and the 2.25rem
 * chevron follows it. The sizes stop at 2.25rem and 3rem, where the date
 * already fits with room to spare.
 */
const dateClass =
  'group text-left font-display text-[length:min(2.25rem,calc((100cqi_-_2rem)/9.6))] text-ink leading-tight md:text-[length:min(3rem,calc((100cqi_-_2.25rem)/15.3))]';

/**
 * The mark after the date that says it opens. The link the date is before
 * hydration wears it too, so the date does not change width when it becomes
 * the button.
 */
const DateChevron = ({ open }: { readonly open: boolean }) => (
  <ChevronDown
    className={[
      'ml-2 inline size-6 align-middle text-ink-muted transition-[rotate,color] duration-200 ease-standard group-hover:text-ink motion-reduce:transition-none md:size-7',
      open ? 'rotate-180' : '',
    ].join(' ')}
  />
);

/**
 * The date and its chevron. Each half keeps to one line, and the chevron stays
 * with the second, so the only place the date can break is after the weekday.
 * A phone breaks it there and leaves the comma to screen readers, where it
 * keeps the date read as one phrase.
 */
const DateLabel = ({
  date,
  open,
}: {
  readonly date: JournalDate;
  readonly open: boolean;
}) => {
  const { weekday, calendarDate } = journalDateLabelParts(date);
  return (
    <>
      <span className="whitespace-nowrap max-md:block">
        {weekday}
        <span className="max-md:sr-only">,</span>
      </span>{' '}
      <span className="whitespace-nowrap">
        {calendarDate}
        <DateChevron open={open} />
      </span>
    </>
  );
};

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
  if (!hydrated) {
    return (
      <a
        aria-label={journalDateLabel(date)}
        className={`${dateClass} ${focusRingClass}`}
        href={`/calendar?month=${journalMonthOf(date)}&day=${date}`}
      >
        <DateLabel date={date} open={false} />
      </a>
    );
  }
  return (
    <button
      aria-controls={open ? pickerId : undefined}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={journalDateLabel(date)}
      className={`${dateClass} ${focusRingClass}`}
      onClick={onToggle}
      ref={triggerRef}
      title="Choose a day"
      type="button"
    >
      <DateLabel date={date} open={open} />
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
      className="relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 pt-2 pb-6 sm:pt-2"
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
              turnsPage={true}
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
        className="@container col-span-2 row-start-2 md:col-span-1"
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
      <div className="col-start-2 row-start-1 -mr-3 flex items-center md:row-start-2">
        <nav aria-label="Nearby days" className="flex items-center">
          {previous === undefined ? (
            <UnavailableStep direction={-1} label="Previous day" />
          ) : (
            <DayLink
              aria-describedby={headingId}
              aria-keyshortcuts="ArrowLeft"
              data-focus-key="previous-day"
              date={previous}
              turnsPage={true}
              label="Previous day"
              title="Previous day (←)"
              today={today}
              variant="icon"
            >
              <StepGlyph direction={-1} />
            </DayLink>
          )}
          {next === undefined ? (
            <UnavailableStep direction={1} label="Next day" />
          ) : (
            <DayLink
              aria-describedby={headingId}
              aria-keyshortcuts="ArrowRight"
              data-focus-key="next-day"
              date={next}
              turnsPage={true}
              label="Next day"
              title="Next day (→)"
              today={today}
              variant="icon"
            >
              <StepGlyph direction={1} />
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
