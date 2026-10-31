import {
  energyOptions,
  progressOptions,
  repeatDayOptions,
} from '../evening-labels.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalNumberLabel } from '../journal-labels.ts';
import { ratingCounts } from '../review-summary.ts';
import type { ReviewDay } from '../review-view.ts';

type Row = {
  readonly name: string;
  readonly answers: ReadonlyArray<{
    readonly label: string;
    readonly count: number;
  }>;
  readonly unrated: number;
};

const rowOf = <Value extends string>(
  days: ReadonlyArray<ReviewDay>,
  today: JournalDate,
  rating: {
    readonly name: string;
    readonly options: ReadonlyArray<{
      readonly value: Value;
      readonly label: string;
    }>;
    readonly pick: (day: ReviewDay) => Value | null;
  },
): Row => {
  const { name, options, pick } = rating;
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
    })),
    unrated,
  };
};

export const RatingCounts = ({
  days,
  today,
}: {
  readonly days: ReadonlyArray<ReviewDay>;
  readonly today: JournalDate;
}) => {
  const rows = [
    rowOf(days, today, {
      name: 'Energy',
      options: energyOptions,
      pick: (day) => day.energy,
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
              <span key={answer.label}>
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
