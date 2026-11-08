/**
 * Every day of the shown year that was written in, as a list with a date on
 * each line.
 *
 * This is the map's accessible alternative and its way in at the same time. The
 * grid says how the year went at a glance and cannot be tabbed through; this
 * says the same thing in words and every line opens the day it names.
 *
 * Only days with writing are listed. The empty ones are in the grid's
 * description, as the gaps in each month's count, and three hundred lines
 * saying nothing happened would bury the ones that say something did.
 *
 * It starts collapsed. A year is a long list, and the writer who came to look
 * at the shape of the year should not have to scroll past it.
 */

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import type { ActivityCell } from '../activity-cells.ts';
import { journalDateLabel } from '../day-label.ts';
import {
  energyOptions,
  progressOptions,
  type RatingOption,
  ratingStepOf,
} from '../evening-labels.ts';
import { energyLabel, progressLabel } from '../insights-labels.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalNumberLabel } from '../journal-labels.ts';
import { DayLink } from './day-link.tsx';
import { RatingSwatch } from './rating-swatch.tsx';

const summaryClass = [
  'w-fit cursor-pointer text-ink-muted underline decoration-1 underline-offset-4 hover:text-ink',
  focusRingClass,
].join(' ');

const dayLinkClass = [
  'text-ink underline decoration-1 underline-offset-4',
  focusRingClass,
].join(' ');

type ActivityTableProps = {
  readonly cells: ReadonlyArray<ActivityCell>;
  readonly today: JournalDate;
};

/** An answer in words, after the square the map draws it in. */
const RatingCell = <Value extends string>({
  value,
  options,
  label,
}: {
  readonly value: Value | null;
  readonly options: ReadonlyArray<RatingOption<Value>>;
  readonly label: (value: Value) => string;
}) => (
  <td className="px-3 py-2 text-ink-muted">
    {value === null ? (
      'Not rated'
    ) : (
      <span className="flex items-center gap-2">
        <RatingSwatch step={ratingStepOf(options, value)} />
        {label(value)}
      </span>
    )}
  </td>
);

export const ActivityTable = ({ cells, today }: ActivityTableProps) => {
  // Newest first: the journal is read backwards from now, not forwards from
  // whenever the shown stretch happens to open.
  const days = cells.filter((cell) => cell.kind === 'day');
  const written = [...days].reverse().filter((cell) => cell.words > 0);

  if (days.length === 0) {
    return (
      <p className="mt-6 border-border border-t pt-4 text-ink-muted">
        This stretch of the journal has not happened yet.
      </p>
    );
  }

  if (written.length === 0) {
    return (
      <p className="mt-6 border-border border-t pt-4 text-ink-muted">
        Nothing was written in this stretch of the journal.
      </p>
    );
  }

  return (
    <details className="mt-6 border-border border-t pt-4 text-sm">
      <summary className={summaryClass}>
        Every day written ({journalNumberLabel(written.length)})
      </summary>
      <section
        aria-label="Days written, scrollable"
        className={[
          'mt-4 max-h-96 overflow-auto border border-border',
          focusRingClass,
        ].join(' ')}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the opened list scrolls, and a scrolling region has to be a tab stop or a keyboard cannot reach the far end of it (WCAG 2.1.1).
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Days written, newest first</caption>
          <thead className="sticky top-0 bg-surface text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium" scope="col">
                Day
              </th>
              <th className="px-3 py-2 text-right font-medium" scope="col">
                Words
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Energy
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            {written.map((cell) => (
              <tr className="border-border border-t" key={cell.date}>
                <td className="px-3 py-2 text-ink">
                  <DayLink
                    variant="text"
                    className={dayLinkClass}
                    date={cell.date}
                    today={today}
                  >
                    {journalDateLabel(cell.date)}
                  </DayLink>
                </td>
                <td className="px-3 py-2 text-right text-ink tabular-nums">
                  {journalNumberLabel(cell.words)}
                </td>
                <RatingCell
                  label={energyLabel}
                  options={energyOptions}
                  value={cell.energy}
                />
                <RatingCell
                  label={progressLabel}
                  options={progressOptions}
                  value={cell.progress}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </details>
  );
};
