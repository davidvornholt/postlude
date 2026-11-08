import { ratingCounts } from '../day-measures.ts';
import {
  energyOptions,
  progressOptions,
  repeatDayOptions,
} from '../evening-labels.ts';
import type { InsightsDay } from '../insights-view.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalNumberLabel } from '../journal-labels.ts';
import type { Energy } from '../schemas/day-rating.ts';
import { EnergySwatch } from './energy-swatch.tsx';

type Row = {
  readonly name: string;
  readonly answers: ReadonlyArray<{
    readonly label: string;
    readonly count: number;
    /** The answer's own color, for energy, the one scale that has them. */
    readonly swatch: Energy | undefined;
  }>;
  readonly unrated: number;
};

const rowOf = <Value extends string>(
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
  rating: {
    readonly name: string;
    readonly options: ReadonlyArray<{
      readonly value: Value;
      readonly label: string;
    }>;
    readonly pick: (day: InsightsDay) => Value | null;
    readonly swatch?: (value: Value) => Energy;
  },
): Row => {
  const { name, options, pick, swatch } = rating;
  const { counts, unrated } = ratingCounts(
    days,
    today,
    options.map((option) => option.value),
    pick,
  );
  return {
    name,
    answers: options.map((option) => ({
      label: option.label,
      count: counts.get(option.value) ?? 0,
      swatch: swatch?.(option.value),
    })),
    unrated,
  };
};

export const RatingCounts = ({
  days,
  today,
}: {
  readonly days: ReadonlyArray<InsightsDay>;
  readonly today: JournalDate;
}) => {
  const rows = [
    rowOf(days, today, {
      name: 'Energy',
      options: energyOptions,
      pick: (day) => day.energy,
      swatch: (energy) => energy,
    }),
    rowOf(days, today, {
      name: 'Progress',
      options: progressOptions,
      pick: (day) => day.progress,
    }),
    rowOf(days, today, {
      name: 'Would repeat',
      options: repeatDayOptions,
      pick: (day) => day.repeatDay,
    }),
  ];
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
      {rows.map((row) => (
        <div className="contents" key={row.name}>
          <dt className="text-ink-muted">{row.name}</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1 text-ink tabular-nums">
            {row.answers.map((answer) => (
              <span className="flex items-center gap-2" key={answer.label}>
                {answer.swatch === undefined ? null : (
                  <EnergySwatch energy={answer.swatch} />
                )}
                {answer.label} {journalNumberLabel(answer.count)}
              </span>
            ))}
            {row.unrated === 0 ? null : (
              <span className="text-ink-muted">
                Not rated {journalNumberLabel(row.unrated)}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};
