/**
 * The table is the charts' text alternative and the one place where a single
 * day's numbers sit together.
 */

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { type DayMeasures, versionChanges } from '../day-measures.ts';
import {
  energyOptions,
  progressOptions,
  type RatingOption,
  ratingStepOf,
  repeatDayOptions,
} from '../evening-labels.ts';
import {
  durationLabel,
  energyLabel,
  progressLabel,
  repeatDayLabel,
  weekdayAbbreviation,
} from '../insights-labels.ts';
import type { InsightsDay } from '../insights-view.ts';
import { type JournalDate, parseJournalDate } from '../journal-day.ts';
import { journalNumberLabel } from '../journal-labels.ts';
import { DayLink } from './day-link.tsx';
import { RatingSwatch } from './rating-swatch.tsx';

const ratingHeaders = ['Energy', 'Progress', 'Would repeat'];
const cellClass =
  'whitespace-nowrap px-2 py-2 text-right tabular-nums last:pr-0';
const noteCellClass = 'px-2 py-2 text-left text-ink-muted';
const headerClass =
  'px-2 pb-2 text-right align-bottom font-normal text-ink-muted last:pr-0';
/**
 * The day stays in view while a phone scrolls the rest of the row sideways, so
 * it carries the page's ground to cover what passes under it.
 */
const dayColumnClass =
  'sticky left-0 z-10 whitespace-nowrap bg-surface py-2 pr-2 text-left font-normal';

const Missing = ({ what }: { readonly what: string }) => (
  <>
    <span aria-hidden="true" className="text-ink-faint">
      –
    </span>
    <span className="sr-only">{what}</span>
  </>
);

const metricColumns: ReadonlyArray<{
  readonly name: string;
  readonly value: (metrics: DayMeasures) => string | null;
}> = [
  {
    name: 'At the screen',
    value: (metrics) =>
      metrics.activeMinutes === null
        ? null
        : durationLabel(metrics.activeMinutes),
  },
  {
    name: 'Focused',
    value: (metrics) =>
      metrics.focusMinutes === null
        ? null
        : durationLabel(metrics.focusMinutes),
  },
  {
    name: 'Short stretches',
    value: (metrics) =>
      metrics.scatteredMinutes === null
        ? null
        : durationLabel(metrics.scatteredMinutes),
  },
  {
    name: 'Off-computer work',
    value: (metrics) =>
      metrics.offComputerMinutes === null
        ? null
        : durationLabel(metrics.offComputerMinutes),
  },
  {
    name: 'Appointments',
    value: (metrics) =>
      metrics.appointmentMinutes === null
        ? null
        : durationLabel(metrics.appointmentMinutes),
  },
  {
    name: 'Pull requests',
    value: (metrics) =>
      metrics.landedPrs === null ? null : journalNumberLabel(metrics.landedPrs),
  },
  {
    name: 'Mail sent',
    value: (metrics) =>
      metrics.sentMail === null ? null : journalNumberLabel(metrics.sentMail),
  },
];

/** An answer in words, after the square the charts draw it in. */
const RatingCell = <Value extends string>({
  value,
  options,
  label,
}: {
  readonly value: Value | null;
  readonly options: ReadonlyArray<RatingOption<Value>>;
  readonly label: (value: Value) => string;
}) => (
  <td className={cellClass}>
    {value === null ? (
      <Missing what="Not rated" />
    ) : (
      <span className="inline-flex items-center gap-2">
        <RatingSwatch step={ratingStepOf(options, value)} />
        {label(value)}
      </span>
    )}
  </td>
);

const RatingCells = ({ day }: { readonly day: InsightsDay }) => (
  <>
    <RatingCell
      label={energyLabel}
      options={energyOptions}
      value={day.energy}
    />
    <RatingCell
      label={progressLabel}
      options={progressOptions}
      value={day.progress}
    />
    <RatingCell
      label={repeatDayLabel}
      options={repeatDayOptions}
      value={day.repeatDay}
    />
  </>
);

const MetricCells = ({ day }: { readonly day: InsightsDay }) => {
  if (day.metrics === null) {
    return (
      <td className={noteCellClass} colSpan={metricColumns.length}>
        No report
      </td>
    );
  }
  const { metrics } = day;
  return (
    <>
      {metricColumns.map((column) => {
        const value = column.value(metrics);
        return (
          <td className={cellClass} key={column.name}>
            {value ?? <Missing what="Not measured" />}
          </td>
        );
      })}
    </>
  );
};

const columnCount = 1 + ratingHeaders.length + metricColumns.length;

const DayRow = ({
  day,
  today,
}: {
  readonly day: InsightsDay;
  readonly today: JournalDate;
}) => (
  <tr className="border-border border-b">
    <th className={dayColumnClass} scope="row">
      <DayLink
        className="text-ink underline decoration-border underline-offset-4 hover:decoration-current"
        date={day.date}
        today={today}
        variant="text"
      >
        {weekdayAbbreviation(day.date)} {parseJournalDate(day.date).day}
      </DayLink>
    </th>
    {day.date > today ? (
      <td className={noteCellClass} colSpan={columnCount - 1}>
        Still to come
      </td>
    ) : (
      <>
        <RatingCells day={day} />
        <MetricCells day={day} />
      </>
    )}
  </tr>
);

const VersionRow = ({ version }: { readonly version: number }) => (
  <tr>
    <td
      className="border-ink border-t-2 border-dotted pt-3 pb-2 text-ink-muted"
      colSpan={columnCount}
    >
      {`Measured differently from here, under metrics version ${version}`}
    </td>
  </tr>
);

export const DayTable = ({
  days,
  today,
}: {
  readonly days: ReadonlyArray<InsightsDay>;
  readonly today: JournalDate;
}) => {
  const changes = new Map(
    versionChanges(days).map(({ index, version }) => [index, version]),
  );
  return (
    <section
      aria-label="Day by day"
      // Relative, so the hidden labels in the cells scroll with the table
      // instead of widening the page.
      className={['relative overflow-x-auto', focusRingClass].join(' ')}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the table scrolls sideways on a phone, and a scrolling region has to be reachable by keyboard to be scrolled.
      tabIndex={0}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border border-b">
            <th
              className={[dayColumnClass, 'align-bottom text-ink-muted'].join(
                ' ',
              )}
              scope="col"
            >
              Day
            </th>
            {[...ratingHeaders, ...metricColumns.map(({ name }) => name)].map(
              (name) => (
                <th className={headerClass} key={name} scope="col">
                  {name}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {days.flatMap((day, index) => {
            const row = <DayRow day={day} key={day.date} today={today} />;
            const version = changes.get(index);
            return version === undefined
              ? [row]
              : [
                  <VersionRow key={`version-${day.date}`} version={version} />,
                  row,
                ];
          })}
        </tbody>
      </table>
    </section>
  );
};
