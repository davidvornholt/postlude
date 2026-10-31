import { useNavigate } from '@tanstack/react-router';
import { UnmarkedActionLink } from '#/shared/ui/action-link.tsx';
import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import { onThisDayBounds } from '../anniversary.ts';
import { type JournalDate, shiftJournalDate } from '../journal-day.ts';
import type { OnThisDayView } from '../services/on-this-day-fns.ts';
import { DateHeading } from './date-heading.tsx';
import { OnThisDay } from './on-this-day.tsx';
import { useStepKeys } from './use-step-keys.ts';

// Today's retrospective keeps the plain address the main navigation opens.
const searchFor = (date: JournalDate, today: JournalDate) =>
  date === today ? {} : { date };

export const OnThisDayPage = ({
  view: { anniversaries, date, today },
}: {
  readonly view: OnThisDayView;
}) => {
  const bounds = onThisDayBounds(today);
  const previous = date > bounds.first ? shiftJournalDate(date, -1) : undefined;
  const next = date < bounds.last ? shiftJournalDate(date, 1) : undefined;
  const navigate = useNavigate();
  const goTo = (chosen: JournalDate) =>
    navigate({ search: searchFor(chosen, today), to: '/on-this-day' });
  // A key has no link to fall back on, so a move the router can't make loads
  // the date as a page instead.
  const stepTo = (step: JournalDate | undefined) =>
    step === undefined
      ? undefined
      : () => {
          goTo(step).catch(() =>
            globalThis.location.assign(
              step === today ? '/on-this-day' : `/on-this-day?date=${step}`,
            ),
          );
        };
  useStepKeys({ previous: stepTo(previous), next: stepTo(next) });

  return (
    <PageFrame>
      <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>On this day</p>
      <header>
        <DateHeading
          action="/on-this-day"
          date={date}
          max={bounds.last}
          min={bounds.first}
          noun="date"
          onChoose={goTo}
        />
        {/* The links step the date rather than name a page, so none of them is
            marked as the current one, even when its address is this page's. */}
        <nav
          aria-label="Nearby retrospective dates"
          className="mt-6 -ml-3 flex flex-wrap items-center gap-x-1 gap-y-3"
        >
          {previous === undefined ? null : (
            <UnmarkedActionLink
              aria-keyshortcuts="ArrowLeft"
              aria-label="Previous date"
              title="Previous date (←)"
              variant="icon"
              search={searchFor(previous, today)}
              to="/on-this-day"
            >
              ←
            </UnmarkedActionLink>
          )}
          {next === undefined ? null : (
            <UnmarkedActionLink
              aria-keyshortcuts="ArrowRight"
              aria-label="Next date"
              title="Next date (→)"
              variant="icon"
              search={searchFor(next, today)}
              to="/on-this-day"
            >
              →
            </UnmarkedActionLink>
          )}
          {date === today ? null : (
            <UnmarkedActionLink
              variant="quiet"
              className="ml-2"
              search={{}}
              to="/on-this-day"
            >
              Today
            </UnmarkedActionLink>
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
    </PageFrame>
  );
};
