/**
 * Going to a day by naming it.
 *
 * Walking back with the previous link is right for last night and wrong for
 * last March, and the archive's table of days is a long way round when the
 * writer already knows the date. This sits in the same row as the nearby-day
 * links, because it answers the same question — which day am I looking at —
 * with the one input a browser already knows how to ask for a date with.
 *
 * It is a real `GET` form pointed at `/day`, which redirects to the day itself.
 * Without JavaScript it submits and the server answers; with it the submit is
 * intercepted and the router navigates instead, which is the same move without
 * the reload. That is the pattern the search page uses, for the same reason:
 * the page should not depend on script having run to do the one thing it is
 * for.
 *
 * Today is the latest day that can be asked for. A day that has not been lived
 * has nothing to hold, and the route refuses one anyway — saying so in the
 * field means the browser's own picker never offers it.
 */

import { useNavigate } from '@tanstack/react-router';
import { type SubmitEvent, useId } from 'react';

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { fieldClass, quietButtonClass } from '#/shared/ui/form-classes.ts';
import { isJournalDate, type JournalDate } from '../journal-day.ts';

type DayJumpProps = {
  /** The day being read, which the field opens on. */
  readonly date: JournalDate;
  /** The server's own journal day, which is as far forward as it can go. */
  readonly today: JournalDate;
};

export const DayJump = ({ date, today }: DayJumpProps) => {
  const fieldId = useId();
  const navigate = useNavigate();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    event.preventDefault();
    const typed = new FormData(form).get('date');
    // An empty or half-typed field is not a day to go to, so the form does
    // nothing rather than sending the writer somewhere they did not name.
    if (typeof typed !== 'string' || !isJournalDate(typed)) {
      return;
    }
    const to =
      typed === today
        ? navigate({ to: '/' })
        : navigate({ params: { date: typed }, to: '/day/$date' });
    // A router that cannot make the move falls back to what the form already
    // is: submitting it natively reaches the same day through a page load.
    to.catch(() => form.submit());
  };

  return (
    <form
      action="/day"
      className="flex flex-wrap items-end gap-x-5 gap-y-3"
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
          // Re-keying on the day lets the field follow a navigation rather than
          // keeping whatever the last page put in it.
          defaultValue={date}
          id={fieldId}
          key={date}
          max={today}
          name="date"
          type="date"
        />
      </div>
      <button className={[quietButtonClass, 'pb-2'].join(' ')} type="submit">
        Open
      </button>
    </form>
  );
};
