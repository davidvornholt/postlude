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
import { type SubmitEvent, useId, useRef } from 'react';

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
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
const dateButtonClass = [
  'block max-w-full text-balance text-left',
  'border-border border-b pb-1',
  'transition-colors duration-150 ease-standard',
  'hover:border-ink-muted',
  focusRingClass,
].join(' ');

export const DayHeading = ({ date, today }: DayHeadingProps) => {
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const label = journalDateLabel(date);

  const jump = (typed: string, form: HTMLFormElement | null) => {
    // An empty, half-typed, or unchanged field is not a day to go to, so
    // nothing moves rather than the writer landing somewhere unasked for.
    if (!isJournalDate(typed) || typed === date) {
      return;
    }
    const moved =
      typed === today
        ? navigate({ to: '/' })
        : navigate({ params: { date: typed }, to: '/day/$date' });
    // A router that cannot make the move falls back to what the form already
    // is: submitting it natively reaches the same day through a page load.
    moved.catch(() => form?.submit());
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const typed = new FormData(form).get('date');
    jump(typeof typed === 'string' ? typed : '', form);
  };

  /*
   * Focus first, then the picker. `showPicker` is not in every browser, and
   * where it is missing a focused field is the whole fallback: it comes out of
   * hiding on focus, so the writer sees the field they just asked for either
   * way.
   */
  const openPicker = () => {
    const input = field.current;
    input?.focus();
    if (typeof input?.showPicker === 'function') {
      input.showPicker();
    }
  };

  return (
    <div className="mt-3">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">
        <button
          aria-label={`${label}. Go to another day.`}
          className={dateButtonClass}
          onClick={openPicker}
          type="button"
        >
          {label}
        </button>
      </h1>
      {/* Clipped rather than absent, and un-clipped the moment anything inside
          it takes focus. A field that was not in the page at all could not be
          reached by a keyboard or read aloud, and would leave the heading as a
          control only a pointer can work. */}
      <form
        action="/day"
        className="sr-only focus-within:not-sr-only focus-within:mt-4 focus-within:flex focus-within:flex-wrap focus-within:items-end focus-within:gap-x-6 focus-within:gap-y-3"
        method="get"
        onSubmit={submit}
      >
        <div>
          <label
            className={[eyebrowClass, 'block text-ink-faint'].join(' ')}
            htmlFor={fieldId}
          >
            Go to a day
          </label>
          <input
            className={[fieldClass, 'mt-2'].join(' ')}
            defaultValue={date}
            id={fieldId}
            // Re-keying on the day lets the field follow a navigation rather
            // than keeping whatever the last page put in it.
            key={date}
            max={today}
            name="date"
            onChange={(event) =>
              jump(event.currentTarget.value, event.currentTarget.form)
            }
            ref={field}
            type="date"
          />
        </div>
        <button className={[quietButtonClass, 'pb-2'].join(' ')} type="submit">
          Open
        </button>
      </form>
    </div>
  );
};
