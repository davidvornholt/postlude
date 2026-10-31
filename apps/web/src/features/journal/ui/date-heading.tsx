/**
 * The page's own date, which is also the way to another one.
 *
 * The day page and On this day are both headed by the date they are about, so
 * a second field underneath saying "go to a day" and holding that same date is
 * the page saying it twice. The heading is the control instead: it carries a
 * rule under it, which is what a field looks like everywhere else in Postlude,
 * and pressing it opens the browser's own date picker over the date it already
 * shows.
 *
 * Under it sits a real `GET` form pointed at the page's own route, which reads
 * the date from `?date=`. The date input is the form's own, hidden while it is
 * not being used and drawn as soon as it takes focus, so a writer moving by
 * keyboard gets a field they can see and type into, and a browser that ran no
 * script still reaches the date through a page load. That is the pattern the
 * search page uses, for the same reason: the page should not need script to do
 * the one thing it is for.
 *
 * The heading is also a polite live region, so a screen reader reads the new
 * date when it changes in place. On this day keeps the same page while its
 * date moves, and without the live region nothing is read after Previous or
 * Today. A day page arrives as a new page instead, and a live region that has
 * only just appeared is not read out, so the day page still announces itself
 * through the focus move it already makes.
 */

import {
  type FocusEvent,
  type MouseEvent,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from '#/shared/ui/action.tsx';
import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { TextField } from '#/shared/ui/text-field.tsx';
import { journalDateLabel } from '../day-label.ts';
import { isJournalDate, type JournalDate } from '../journal-day.ts';

type DateHeadingProps = {
  /** The date the page is about, which the heading names and the field opens on. */
  readonly date: JournalDate;
  /** Lets the controls that step from this date say which date that is. */
  readonly headingId?: string;
  /** The route a browser without script submits `?date=` to. */
  readonly action: '/day' | '/on-this-day';
  /** What the page calls the thing it moves between, in the field's labels. */
  readonly noun: 'day' | 'date';
  readonly min: JournalDate;
  readonly max: JournalDate;
  /**
   * Moves to the chosen date inside the app. A move the router cannot make
   * falls back to submitting the form natively.
   */
  readonly onChoose: (date: JournalDate) => Promise<void>;
};

/*
 * The rule is the same one every other field in the app wears, at the size the
 * date is set in. It rests in the border ink and deepens under a pointer, so
 * the heading says it can be pressed before it is touched — and it is balanced,
 * because a date is one thing and breaking it after the month leaves a year
 * alone on a line.
 */
const dateLabelClass = [
  'block max-w-full cursor-pointer text-balance text-left',
  'border-ink-muted border-b pb-1',
  'transition-colors duration-150 ease-standard',
  'hover:border-ink',
].join(' ');

const visibleControlsClass = 'flex flex-wrap items-end gap-x-6 gap-y-3';
const fallbackControlsClass = [
  'sr-only',
  'group-focus-within:not-sr-only group-focus-within:flex',
  'group-focus-within:flex-wrap group-focus-within:items-end',
  'group-focus-within:gap-x-6 group-focus-within:gap-y-3',
].join(' ');

export const DateHeading = ({
  date,
  headingId,
  action,
  noun,
  min,
  max,
  onChoose,
}: DateHeadingProps) => {
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  // Which date the open field belongs to. On this day keeps this component
  // while its date changes, and the field it re-keys disappears without a blur,
  // so tying the open state to the date closes it when the date moves on.
  const [openFor, setOpenFor] = useState<JournalDate>();
  const active = openFor === date;
  const label = journalDateLabel(date);

  const jump = (typed: JournalDate, form: HTMLFormElement) => {
    if (typed === date) {
      return;
    }
    // A router that cannot make the move falls back to what the form already
    // is: submitting it natively reaches the same date through a page load.
    onChoose(typed).catch(() => form.submit());
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('date');
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.setCustomValidity('');
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
    if (!isJournalDate(input.value)) {
      input.setCustomValidity('Choose a valid journal date.');
      input.reportValidity();
      return;
    }
    jump(input.value, form);
  };

  // A label only focuses its field, which leaves a desktop browser's calendar
  // one more click away on a small icon. Pressing the date is asking for a
  // date, so the press opens the picker as well. Without script the label keeps
  // its native behaviour, and a browser that cannot open a picker from here is
  // left with the focused field.
  const openPicker = (event: MouseEvent<HTMLLabelElement>) => {
    const input = fieldRef.current;
    if (input === null) {
      return;
    }
    event.preventDefault();
    input.focus();
    try {
      input.showPicker();
    } catch {
      // The field already has focus, which is what the label alone would do.
    }
  };

  const leaveControls = (
    event: FocusEvent<HTMLInputElement | HTMLButtonElement>,
  ) => {
    const { currentTarget, relatedTarget: next } = event;
    const { form } = currentTarget;
    if (!(form !== null && next instanceof Element && form.contains(next))) {
      setOpenFor(undefined);
    }
  };

  return (
    <form action={action} className="group mt-3" method="get" onSubmit={submit}>
      <h1
        aria-atomic="true"
        aria-live="polite"
        id={headingId}
        className={[
          'text-balance font-display text-4xl text-ink sm:text-5xl',
          active ? 'sr-only' : 'group-focus-within:sr-only',
        ].join(' ')}
      >
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/useKeyWithClickEvents: the label is not a tab stop; a keyboard reaches the field directly and opens the picker with the browser's own keys, so the click only shortens the pointer path the label already has. */}
        <label
          className={dateLabelClass}
          htmlFor={fieldId}
          onClick={openPicker}
        >
          {label}
        </label>
      </h1>
      {/* The heading and field trade places while the form has focus. The page
          therefore shows the date once, while a keyboard still reaches the
          native field and a browser without script still submits a GET. */}
      <div className={active ? visibleControlsClass : fallbackControlsClass}>
        <div>
          <label
            className={[eyebrowClass, 'block text-ink-faint'].join(' ')}
            htmlFor={fieldId}
          >
            {`Go to a ${noun}`}
          </label>
          <TextField
            aria-label={`${label}. Go to another ${noun}.`}
            className="mt-2"
            defaultValue={date}
            id={fieldId}
            // Re-keying on the date lets the field follow a navigation rather
            // than keeping whatever the last page put in it.
            key={date}
            max={max}
            min={min}
            name="date"
            onBlur={leaveControls}
            onFocus={() => setOpenFor(date)}
            onInput={(event) => event.currentTarget.setCustomValidity('')}
            ref={fieldRef}
            required={true}
            type="date"
          />
        </div>
        <Button
          variant="quiet"
          className="pb-2"
          onBlur={leaveControls}
          onFocus={() => setOpenFor(date)}
          type="submit"
        >
          Open
        </Button>
      </div>
    </form>
  );
};
