/**
 * The steps from a day page to the days either side of it: two arrows above
 * the date, where the page starts, and two named days at its end.
 *
 * The day ends where the next one begins, so finishing it leads on without a
 * climb back to the arrows at the top. Each step names the day it leads to,
 * in the words it is read by as well, because the arrows are out of sight by
 * here and the page above has been about this day, not the ones beside it.
 *
 * Neither step keeps focus on the page it opens, as the arrows at the top do:
 * a step from the end of a day is a page turned, and reading starts again at
 * the top.
 */

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { DayLink } from './day-link.tsx';

/**
 * Two arrows rather than two labels. The heading below them already names the
 * day they step from, so spelling out "previous day" beside it is the page
 * saying the same thing a third time — and the pair reads as one stepper at a
 * glance, which two lines of small capitals never did. Each one still says
 * where it goes in `aria-label`, and the arrow sits in a target wider than the
 * arrow.
 *
 * Focus stays on the arrow a step was made with, so stepping on is one more
 * press rather than a tab back up the page, and the arrow is described by the
 * heading, so it names the day it now steps from.
 */
export const NearbyDays = ({
  headingId,
  previous,
  next,
  today,
}: {
  readonly headingId: string;
  readonly previous: JournalDate | undefined;
  readonly next: JournalDate | undefined;
  readonly today: JournalDate;
}) => (
  <nav aria-label="Nearby days" className="flex gap-1">
    {previous === undefined ? null : (
      <DayLink
        aria-describedby={headingId}
        aria-keyshortcuts="ArrowLeft"
        data-focus-key="previous-day"
        date={previous}
        label="Previous day"
        title="Previous day (←)"
        today={today}
        variant="icon"
      >
        ←
      </DayLink>
    )}
    {next === undefined ? null : (
      <DayLink
        aria-describedby={headingId}
        aria-keyshortcuts="ArrowRight"
        data-focus-key="next-day"
        date={next}
        label="Next day"
        title="Next day (→)"
        today={today}
        variant="icon"
      >
        →
      </DayLink>
    )}
  </nav>
);

const turnLinkClass = ['group block py-1', focusRingClass].join(' ');
const turnDateClass =
  'mt-2 block text-balance font-display text-ink text-xl underline decoration-transparent underline-offset-4 transition-colors duration-150 ease-standard group-hover:decoration-current motion-reduce:transition-none';

const Turn = ({
  date,
  side,
  today,
}: {
  readonly date: JournalDate;
  readonly side: 'before' | 'after';
  readonly today: JournalDate;
}) => (
  <DayLink
    className={
      side === 'before'
        ? turnLinkClass
        : [turnLinkClass, 'sm:ml-auto sm:text-right'].join(' ')
    }
    date={date}
    today={today}
    variant="text"
  >
    <span className={[eyebrowClass, 'block text-ink-faint'].join(' ')}>
      {side === 'before' ? (
        <>
          <span aria-hidden="true">← </span>Day before
        </>
      ) : (
        <>
          Day after<span aria-hidden="true"> →</span>
        </>
      )}
    </span>{' '}
    <span className={turnDateClass}>{journalDateLabel(date)}</span>
  </DayLink>
);

export const DayTurns = ({
  previous,
  next,
  today,
}: {
  readonly previous: JournalDate | undefined;
  readonly next: JournalDate | undefined;
  readonly today: JournalDate;
}) => (
  <PageFrame className="mt-16 sm:mt-24">
    <nav
      aria-label="Day before and after"
      className="flex flex-col gap-6 border-border border-t pt-8 sm:flex-row sm:justify-between"
    >
      {previous === undefined ? null : (
        <Turn date={previous} side="before" today={today} />
      )}
      {next === undefined ? null : (
        <Turn date={next} side="after" today={today} />
      )}
    </nav>
  </PageFrame>
);
