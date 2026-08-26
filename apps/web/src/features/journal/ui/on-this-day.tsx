/**
 * The same date, in the years before the one being read.
 *
 * This is about reading rather than measuring. It renders the date metadata
 * first, then the writer's prose from the entry. The opening prefers evening
 * prose and falls back to scripture notes. The whole line is the link, because
 * the reason to open the day is the sentence, not the date above it.
 *
 * Whether there is anything to show is the caller's question, not this one's:
 * the day page leaves the whole section out on a date with no years behind it,
 * rather than heading an empty list.
 */

import {
  eyebrowClass,
  focusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import type { Anniversary } from '../anniversary.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalCountLabel } from '../journal-labels.ts';
import { DayLink } from './day-link.tsx';

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
        >{`${journalCountLabel(anniversary.yearsAgo, 'year')} ago · ${journalDateLabel(anniversary.date)}`}</span>
        <span
          className={[readingMeasureClass, 'mt-3 block text-ink text-lg'].join(
            ' ',
          )}
        >
          {anniversary.snippet}
        </span>
      </DayLink>
    ))}
  </div>
);
