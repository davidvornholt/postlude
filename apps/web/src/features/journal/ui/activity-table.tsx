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
 * It starts collapsed. A year is a long list, and the writer who came to the
 * archive to look at the shape of the year should not have to scroll past it.
 */

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import type { ActivityCell } from '../activity.ts';
import { groupDigits, heatLevelLabels } from '../activity-labels.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { DayLink } from './day-link.tsx';

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

export const ActivityTable = ({ cells, today }: ActivityTableProps) => {
  // Newest first: the archive is read backwards from now, not forwards from
  // whenever the window happens to open.
  const written = [...cells].reverse().filter((cell) => cell.words > 0);

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
        Every day written ({written.length})
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
              <th className="px-3 py-2 font-medium" scope="col">
                Activity
              </th>
              <th className="px-3 py-2 text-right font-medium" scope="col">
                Words
              </th>
            </tr>
          </thead>
          <tbody>
            {written.map((cell) => (
              <tr className="border-border border-t" key={cell.date}>
                <td className="px-3 py-2 text-ink">
                  <DayLink
                    className={dayLinkClass}
                    date={cell.date}
                    today={today}
                  >
                    {journalDateLabel(cell.date)}
                  </DayLink>
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {heatLevelLabels[cell.level]}
                </td>
                <td className="px-3 py-2 text-right text-ink tabular-nums">
                  {groupDigits(cell.words)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </details>
  );
};
