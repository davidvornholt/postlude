/**
 * All time, a month to a square: a row for each year, newest at the top, and
 * a column for each month, so the same month lines up down the years and a
 * season can be compared with itself.
 *
 * A square is shaded by how much the month was written against the other
 * months. By energy or progress it is split instead, into the share of its
 * rated days at each answer, low to high, in the colors every rating shares:
 * an average of three answers would put nearly every month in the middle,
 * and the mix is what changes with the seasons. Its label says the counts
 * behind the shade, and it opens that month, as each year's name opens that
 * year.
 *
 * Every month is a link, but the months are one stop in the tab order: the
 * arrow keys move between them, so a journal of many years does not put a
 * hundred stops between the reader and the rest of the page.
 */

import { Link } from '@tanstack/react-router';
import {
  type KeyboardEvent,
  type RefCallback,
  useId,
  useRef,
  useState,
} from 'react';

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { type JournalMonth, journalMonthLabel } from '../calendar.ts';
import {
  energyOptions,
  progressOptions,
  type RatingOption,
} from '../evening-labels.ts';
import { insightsSearch } from '../insights-address.ts';
import {
  type InsightsMeasure,
  monthWritingLevel,
} from '../insights-measure.ts';
import {
  type AnswerTally,
  type MonthSummary,
  monthAfterKey,
  monthGrid,
  type YearOfMonths,
} from '../insights-patterns.ts';
import { yearLabel } from '../insights-range.ts';
import type { InsightsDay } from '../insights-view.ts';
import type { JournalDate } from '../journal-day.ts';
import {
  journalCountLabel,
  journalMonthLabel as monthName,
} from '../journal-labels.ts';
import { heatSquareClass } from './activity-cell-classes.ts';
import { HeatLegend } from './heat-legend.tsx';

const monthsPerYear = 12;
const shortMonthLength = 3;
const monthNumbers = Array.from(
  { length: monthsPerYear },
  (_, index) => index + 1,
);

/** The answers a month is split into, and its tally of them, by measure. */
type RatingMixOf = (summary: MonthSummary) => {
  readonly tally: AnswerTally<string>;
  readonly options: ReadonlyArray<RatingOption<string>>;
};

const ratingMixOf = (
  measure: Exclude<InsightsMeasure, 'writing'>,
): RatingMixOf =>
  measure === 'energy'
    ? (summary) => ({ tally: summary.energy, options: energyOptions })
    : (summary) => ({ tally: summary.progress, options: progressOptions });

/**
 * A month's answers as a strip for each answer it had, as wide as that
 * answer's share of the rated days. Each strip keeps two pixels at least, so
 * one drained day in a month of okay ones still shows. A month with nothing
 * rated has no strips and stays the outlined square.
 */
const RatingMix = <Answer extends string>({
  tally,
  options,
}: {
  readonly tally: AnswerTally<Answer>;
  readonly options: ReadonlyArray<RatingOption<Answer>>;
}) =>
  options
    .filter((option) => tally.counts[option.value] > 0)
    .map((option) => (
      <span
        className={['min-w-0.5 basis-0', heatSquareClass(option.step)].join(
          ' ',
        )}
        key={option.value}
        // biome-ignore lint/nursery/noInlineStyles: The strip's width is its answer's count, known only at run time.
        style={{ flexGrow: tally.counts[option.value] }}
      />
    ));

const answersSaid = <Answer extends string>(
  name: string,
  tally: AnswerTally<Answer>,
  options: ReadonlyArray<{ readonly value: Answer; readonly label: string }>,
): string =>
  tally.rated === 0
    ? `${name} not rated`
    : `${name} ${[...options]
        .reverse()
        .filter((option) => tally.counts[option.value] > 0)
        .map(
          (option) =>
            `${option.label.toLowerCase()} ${tally.counts[option.value]}`,
        )
        .join(', ')}`;

const monthDetails = (summary: MonthSummary): string =>
  [
    journalMonthLabel(summary.month),
    `written on ${summary.written} of ${journalCountLabel(summary.elapsed, 'day')}`,
    journalCountLabel(summary.words, 'word'),
    answersSaid('energy', summary.energy, energyOptions),
    answersSaid('progress', summary.progress, progressOptions),
  ].join(' · ');

/** The month the details line and the tab stop are on, and the moves between. */
const useActiveMonth = (years: ReadonlyArray<YearOfMonths>) => {
  const latest = years[0]?.months
    .filter((summary) => summary !== undefined)
    .at(-1);
  const [chosen, setChosen] = useState<JournalMonth | undefined>();
  const active =
    years
      .flatMap((year) => year.months)
      .find((summary) => summary !== undefined && summary.month === chosen) ??
    latest;
  const linksRef = useRef(new Map<JournalMonth, HTMLAnchorElement>());
  const register =
    (month: JournalMonth): RefCallback<HTMLAnchorElement> =>
    (element) => {
      if (element === null) {
        linksRef.current.delete(month);
      } else {
        linksRef.current.set(month, element);
      }
    };
  const moveFrom = (
    month: JournalMonth,
    event: KeyboardEvent<HTMLAnchorElement>,
  ): void => {
    const next = monthAfterKey(years, month, event.key);
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    setChosen(next.month);
    linksRef.current.get(next.month)?.focus();
  };
  return { active, choose: setChosen, moveFrom, register };
};

const MonthHeader = () => (
  <thead>
    <tr>
      <td className="w-12 sm:w-14" />
      {monthNumbers.map((month) => (
        <th
          abbr={monthName(month)}
          className="pb-1 text-center font-normal text-ink-faint text-xs"
          key={month}
          scope="col"
        >
          <span className="sm:hidden">{monthName(month).slice(0, 1)}</span>
          <span className="hidden sm:inline">
            {monthName(month).slice(0, shortMonthLength)}
          </span>
        </th>
      ))}
    </tr>
  </thead>
);

export const MonthGrid = ({
  days,
  measure,
  today,
}: {
  readonly days: ReadonlyArray<InsightsDay>;
  readonly measure: InsightsMeasure;
  readonly today: JournalDate;
}) => {
  const captionId = useId();
  const years = monthGrid(days, today);
  const { active, choose, moveFrom, register } = useActiveMonth(years);
  const mixOf = measure === 'writing' ? undefined : ratingMixOf(measure);
  const writingLevel = monthWritingLevel(
    years
      .flatMap((year) => year.months)
      .filter((summary) => summary !== undefined),
  );
  const fillOf = (summary: MonthSummary): string => {
    if (mixOf === undefined) {
      return `block ${heatSquareClass(writingLevel(summary))}`;
    }
    return mixOf(summary).tally.rated === 0
      ? `block ${heatSquareClass('none')}`
      : 'flex gap-px';
  };

  return (
    <figure className="m-0">
      <table
        aria-labelledby={captionId}
        className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1"
      >
        <caption className="sr-only" id={captionId}>
          Every month since the journal began, by year. Use the arrow keys to
          move between months and Enter to open one.
        </caption>
        <MonthHeader />
        <tbody>
          {years.map((year) => (
            <tr key={year.year}>
              <th className="pr-2 text-left font-normal text-sm" scope="row">
                <Link
                  className={[
                    'text-ink-muted tabular-nums underline-offset-4 hover:text-ink hover:underline',
                    focusRingClass,
                  ].join(' ')}
                  search={insightsSearch(
                    { kind: 'year', year: year.year },
                    today,
                  )}
                  to="/insights"
                >
                  {yearLabel(year.year)}
                </Link>
              </th>
              {year.months.map((summary, index) => (
                <td className="p-0" key={monthNumbers[index]}>
                  {summary === undefined ? null : (
                    <Link
                      aria-label={monthDetails(summary)}
                      className={[
                        'h-7 sm:h-9',
                        fillOf(summary),
                        summary.month === active?.month
                          ? 'outline outline-ink outline-offset-1'
                          : '',
                        focusRingClass,
                      ].join(' ')}
                      onFocus={() => choose(summary.month)}
                      onKeyDown={(event) => moveFrom(summary.month, event)}
                      onPointerEnter={() => choose(summary.month)}
                      ref={register(summary.month)}
                      search={insightsSearch(
                        { kind: 'month', month: summary.month },
                        today,
                      )}
                      tabIndex={summary.month === active?.month ? 0 : -1}
                      to="/insights"
                    >
                      {mixOf === undefined ? null : (
                        <RatingMix {...mixOf(summary)} />
                      )}
                    </Link>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p aria-hidden="true" className="mt-4 min-h-5 text-ink-muted text-sm">
        {active === undefined ? null : monthDetails(active)}
      </p>
      <figcaption className={eyebrowClass}>
        <HeatLegend measure={measure} />
      </figcaption>
    </figure>
  );
};
