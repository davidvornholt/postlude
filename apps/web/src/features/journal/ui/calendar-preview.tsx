import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalCountLabel } from '../journal-labels.ts';
import type { CalendarDay } from '../services/calendar-fns.ts';
import { DayLink } from './day-link.tsx';

const PreviewWords = ({ day }: { readonly day: CalendarDay | undefined }) => {
  if (day === undefined) {
    return <p className="text-ink-muted">Nothing was written on this day.</p>;
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
  return <p className="hyphens-auto text-ink leading-7">{day.snippet}</p>;
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
      <PreviewWords day={day} />
      {day === undefined ? null : (
        <p className={[eyebrowClass, 'mt-5 text-ink-faint'].join(' ')}>
          {journalCountLabel(day.words, 'word')}
        </p>
      )}
      <DayLink
        className={[quietButtonClass, 'mt-7'].join(' ')}
        date={selected}
        today={today}
      >
        {selected === today ? 'Open today' : 'Open day'}
      </DayLink>
    </div>
  </aside>
);
