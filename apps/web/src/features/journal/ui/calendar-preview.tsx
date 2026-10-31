import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalCountLabel } from '../journal-labels.ts';
import { journalLanguage } from '../journal-language.ts';
import type { CalendarDay } from '../services/calendar-fns.ts';
import { DayLink } from './day-link.tsx';

/**
 * An unwritten day reads by where it falls: today is still being lived and a
 * day ahead has not come yet, so only a past day can have gone unwritten.
 */
const unwrittenWording = (
  selected: JournalDate,
  today: JournalDate,
): string => {
  if (selected === today) {
    return 'Nothing written yet today.';
  }
  return selected > today
    ? 'Nothing written for this day yet.'
    : 'Nothing was written on this day.';
};

/** An unwritten day is opened to be written, so the link says that. */
const linkWording = (
  day: CalendarDay | undefined,
  selected: JournalDate,
  today: JournalDate,
): string => {
  const verb = day === undefined ? 'Write' : 'Open';
  return selected === today ? `${verb} today` : `${verb} this day`;
};

const PreviewWords = ({
  day,
  selected,
  today,
}: {
  readonly day: CalendarDay | undefined;
  readonly selected: JournalDate;
  readonly today: JournalDate;
}) => {
  if (day === undefined) {
    return (
      <p className="text-ink-muted">{unwrittenWording(selected, today)}</p>
    );
  }
  if (day.snippet === '') {
    return (
      <p className="text-ink-muted">
        {day.hasScriptureReference
          ? 'A scripture passage was noted.'
          : 'This day contains Markdown without readable prose.'}
      </p>
    );
  }
  return (
    <p className="hyphens-auto text-ink leading-7" lang={journalLanguage}>
      {day.snippet}
    </p>
  );
};

export const CalendarPreview = ({
  day,
  selected,
  today,
}: {
  readonly day: CalendarDay | undefined;
  readonly selected: JournalDate;
  readonly today: JournalDate;
}) => (
  <aside
    className="border-border border-t pt-6 lg:mt-0"
    aria-label="Selected day"
  >
    <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>
      {selected === today ? 'Today' : 'Selected day'}
    </p>
    <h2 className="mt-3 text-balance font-display text-2xl text-ink">
      {journalDateLabel(selected)}
    </h2>
    <div className={[readingMeasureClass, 'mt-6'].join(' ')}>
      <PreviewWords day={day} selected={selected} today={today} />
      {day === undefined ? null : (
        <p className={[eyebrowClass, 'mt-5 text-ink-faint'].join(' ')}>
          {journalCountLabel(day.words, 'word')}
        </p>
      )}
      <DayLink variant="quiet" className="mt-7" date={selected} today={today}>
        {linkWording(day, selected, today)}
      </DayLink>
    </div>
  </aside>
);
