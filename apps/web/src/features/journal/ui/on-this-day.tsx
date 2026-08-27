/**
 * The same day of the month, in the years before this one.
 *
 * This is the one part of the archive that is about reading rather than about
 * measuring. It leads with the writer's own words, the date, and then prose
 * from the entry. The opening prefers evening prose and falls back to scripture
 * notes. The whole line is the link, because the reason to open the day is the
 * sentence, not the date above it.
 *
 * It is absent on a day with no earlier years behind it. An empty "on this day"
 * would take a section's worth of the page every day of a journal's first year
 * to say nothing.
 */

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import type { Anniversary } from '../services/archive-fns.ts';
import { DayLink } from './day-link.tsx';

const one = 1;

const linkClass = [
  'block border-border border-t py-5',
  'transition-colors duration-150 ease-standard hover:border-ink-muted',
  focusRingClass,
].join(' ');

type OnThisDayProps = {
  readonly anniversaries: ReadonlyArray<Anniversary>;
  readonly today: JournalDate;
};

export const OnThisDay = ({ anniversaries, today }: OnThisDayProps) => (
  <div>
    {anniversaries.map((anniversary) => (
      <DayLink
        className={linkClass}
        date={anniversary.date}
        key={anniversary.date}
        today={today}
      >
        <span
          className={[eyebrowClass, 'block text-ink-faint'].join(' ')}
        >{`${anniversary.yearsAgo} year${anniversary.yearsAgo === one ? '' : 's'} ago · ${journalDateLabel(anniversary.date)}`}</span>
        <span className="mt-3 block max-w-prose text-ink text-lg">
          {anniversary.snippet}
        </span>
      </DayLink>
    ))}
  </div>
);
