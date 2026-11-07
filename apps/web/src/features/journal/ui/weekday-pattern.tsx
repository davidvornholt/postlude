/**
 * The range read by weekday: how often each one got written, how long it ran
 * when it did, and how often it felt fresh. A week has a shape of its own —
 * a Sunday that is always written, a Thursday that never is — and it only
 * shows once the same weekday can be set beside itself a few times.
 *
 * The shares are of the weekday's days so far, so a range that holds five
 * Mondays and four Sundays still compares them fairly, and each share is
 * written out beside its bar so nothing has to be read off the bar itself.
 */

import type { WeekdayPattern } from '../insights-patterns.ts';
import { journalNumberLabel, journalWeekdayLabel } from '../journal-labels.ts';

const percent = 100;
const daysPerWeek = 7;

const shareLabel = (part: number, whole: number): string =>
  whole === 0 ? '–' : `${Math.round((part / whole) * percent)}%`;

/** Monday is 0 here and Sunday 0 in the label table, as `Date` counts them. */
const weekdayName = (weekday: number): string =>
  journalWeekdayLabel((weekday + 1) % daysPerWeek);

const shortNameLength = 3;

const barScale = 100;

const Bar = ({ share }: { readonly share: number }) => (
  <svg
    aria-hidden="true"
    className="block h-2 w-full"
    preserveAspectRatio="none"
    viewBox={`0 0 ${barScale} 1`}
  >
    <rect className="fill-surface-sunken" height={1} width={barScale} />
    <rect className="fill-primary" height={1} width={share * barScale} />
  </svg>
);

export const WeekdayPatternTable = ({
  patterns,
}: {
  readonly patterns: ReadonlyArray<WeekdayPattern>;
}) => (
  <table className="w-full border-collapse text-sm">
    <caption className="sr-only">
      How often each weekday was written, how long a written one ran, and how
      often it felt fresh
    </caption>
    <thead>
      <tr className="text-left text-ink-faint">
        <th className="py-2 pr-4 font-normal" scope="col">
          Day
        </th>
        <th className="py-2 pr-4 font-normal" scope="col">
          Written
        </th>
        <th className="py-2 pr-4 text-right font-normal" scope="col">
          Words
        </th>
        <th className="py-2 text-right font-normal" scope="col">
          Fresh
        </th>
      </tr>
    </thead>
    <tbody>
      {patterns.map((pattern) => (
        <tr className="border-border border-t" key={pattern.weekday}>
          <th className="py-2 pr-4 text-left font-normal text-ink" scope="row">
            <span className="sm:hidden">
              {weekdayName(pattern.weekday).slice(0, shortNameLength)}
            </span>
            <span className="hidden sm:inline">
              {weekdayName(pattern.weekday)}
            </span>
          </th>
          <td className="w-2/5 py-2 pr-4 sm:w-1/2">
            <span className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
              <Bar
                share={
                  pattern.elapsed === 0 ? 0 : pattern.written / pattern.elapsed
                }
              />
              <span className="text-right text-ink tabular-nums">
                {shareLabel(pattern.written, pattern.elapsed)}
              </span>
            </span>
          </td>
          <td className="py-2 pr-4 text-right text-ink-muted tabular-nums">
            {pattern.typicalWords === undefined
              ? '–'
              : journalNumberLabel(pattern.typicalWords)}
          </td>
          <td className="py-2 text-right text-ink-muted tabular-nums">
            {shareLabel(pattern.fresh, pattern.rated)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
