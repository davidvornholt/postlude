/**
 * The day's own name, which is also the way to another one.
 *
 * The page is already headed by the date it is about, so a second field
 * underneath it saying "go to a day" and holding that same date is the page
 * saying it twice. The heading is the control instead: it carries a rule under
 * it, which is what a field looks like everywhere else in Postlude, and
 * pressing it opens the browser's own date picker over the date it already
 * shows.
 *
 * Under it sits a real `GET` form pointed at `/day`, a route that redirects to
 * the day itself. The date input is the form's own, hidden while it is not
 * being used and drawn as soon as it takes focus, so a writer moving by keyboard
 * gets a field they can see and type into, and a browser that ran no script
 * still reaches the day through a page load. That is the pattern the search page
 * uses, for the same reason: the page should not need script to do the one thing
 * it is for.
 *
 * Today is as far forward as it goes. A day that has not been lived has nothing
 * to hold, and the route refuses one anyway — saying so in the field means the
 * picker never offers it.
 */

import { useNavigate } from '@tanstack/react-router';
import { type FocusEvent, type SubmitEvent, useId, useState } from 'react';

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { fieldClass, quietButtonClass } from '#/shared/ui/form-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import { isJournalDate, type JournalDate } from '../journal-day.ts';

type DayHeadingProps = {
  /** The day being read, which the heading names and the field opens on. */
  readonly date: JournalDate;
  /** The server's own journal day, which is as far forward as it can go. */
  readonly today: JournalDate;
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

export const DayHeading = ({ date, today }: DayHeadingProps) => {
  const fieldId = useId();
  const [active, setActive] = useState(false);
  const navigate = useNavigate();
  const label = journalDateLabel(date);

  const jump = (typed: JournalDate, form: HTMLFormElement) => {
    if (typed === date) {
      return;
    }
    const moved =
      typed === today
        ? navigate({ to: '/' })
        : navigate({ params: { date: typed }, to: '/day/$date' });
    // A router that cannot make the move falls back to what the form already
    // is: submitting it natively reaches the same day through a page load.
    moved.catch(() => form.submit());
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
    if (!isJournalDate(input.value) || input.value > today) {
      input.setCustomValidity('Choose a date from 0001 through today.');
      input.reportValidity();
      return;
    }
    jump(input.value, form);
  };

  const leaveControls = (
    event: FocusEvent<HTMLInputElement | HTMLButtonElement>,
  ) => {
    const { currentTarget, relatedTarget: next } = event;
    const { form } = currentTarget;
    if (!(form !== null && next instanceof Element && form.contains(next))) {
      setActive(false);
    }
  };

  return (
    <form action="/day" className="group mt-3" method="get" onSubmit={submit}>
      <h1
        className={[
          'text-balance font-display text-4xl text-ink sm:text-5xl',
          active ? 'sr-only' : 'group-focus-within:sr-only',
        ].join(' ')}
      >
        <label className={dateLabelClass} htmlFor={fieldId}>
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
            Go to a day
          </label>
          <input
            aria-label={`${label}. Go to another day.`}
            className={[fieldClass, 'mt-2'].join(' ')}
            defaultValue={date}
            id={fieldId}
            // Re-keying on the day lets the field follow a navigation rather
            // than keeping whatever the last page put in it.
            key={date}
            max={today}
            name="date"
            onBlur={leaveControls}
            onFocus={() => setActive(true)}
            onInput={(event) => event.currentTarget.setCustomValidity('')}
            required={true}
            type="date"
          />
        </div>
        <button
          className={[quietButtonClass, 'pb-2'].join(' ')}
          onBlur={leaveControls}
          onFocus={() => setActive(true)}
          type="submit"
        >
          Open
        </button>
      </div>
    </form>
  );
};
