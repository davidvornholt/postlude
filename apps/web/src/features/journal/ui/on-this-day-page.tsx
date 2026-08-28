import { Link } from '@tanstack/react-router';

import {
  eyebrowClass,
  pageFrameClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { iconButtonClass, quietButtonClass } from '#/shared/ui/form-classes.ts';
import { onThisDayBounds } from '../anniversary.ts';
import { journalDateLabel } from '../day-label.ts';
import { shiftJournalDate } from '../journal-day.ts';
import type { OnThisDayView } from '../services/on-this-day-fns.ts';
import { OnThisDay } from './on-this-day.tsx';

export const OnThisDayPage = ({
  view: { anniversaries, date, today },
}: {
  readonly view: OnThisDayView;
}) => {
  const bounds = onThisDayBounds(today);
  const previous = date > bounds.first ? shiftJournalDate(date, -1) : undefined;
  const next = date < bounds.last ? shiftJournalDate(date, 1) : undefined;

  return (
    <div className={pageFrameClass}>
      <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>On this day</p>
      <header>
        <h1 className="mt-3 text-balance font-display text-4xl text-ink sm:text-5xl">
          {journalDateLabel(date)}
        </h1>
        <nav
          aria-label="Nearby retrospective dates"
          className="mt-6 -ml-3 flex flex-wrap items-center gap-x-1 gap-y-3"
        >
          {previous === undefined ? null : (
            <Link
              aria-label="Previous date"
              className={iconButtonClass}
              search={{ date: previous }}
              to="/on-this-day"
            >
              ←
            </Link>
          )}
          {next === undefined ? null : (
            <Link
              aria-label="Next date"
              className={iconButtonClass}
              search={next === today ? {} : { date: next }}
              to="/on-this-day"
            >
              →
            </Link>
          )}
          {date === today ? null : (
            <Link
              className={[quietButtonClass, 'ml-2'].join(' ')}
              search={{}}
              to="/on-this-day"
            >
              Today
            </Link>
          )}
        </nav>
      </header>
      <p
        className={[readingMeasureClass, 'mt-5 text-ink-muted text-lg'].join(
          ' ',
        )}
      >
        The same date, in earlier years.
      </p>
      {anniversaries.length === 0 ? (
        <p
          className={[
            readingMeasureClass,
            'mt-10 border-border border-t pt-8 text-ink-muted',
          ].join(' ')}
        >
          Nothing was written on this date in an earlier year.
        </p>
      ) : (
        <div className="mt-10">
          <OnThisDay anniversaries={anniversaries} today={today} />
        </div>
      )}
    </div>
  );
};
