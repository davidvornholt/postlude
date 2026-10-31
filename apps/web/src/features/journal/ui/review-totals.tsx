import type { ReactNode } from 'react';

import { journalCountLabel, journalNumberLabel } from '../journal-labels.ts';
import { durationLabel } from '../review-labels.ts';
import { sentMailCount, type Tally, tally } from '../review-summary.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';

const percent = 100;

const coverage = (counted: Tally): string =>
  counted.missing === 0
    ? `over ${journalCountLabel(counted.measured, 'day')}`
    : `over ${journalCountLabel(counted.measured, 'day')}, not measured on ${journalCountLabel(counted.missing, 'day')}`;

const Figure = ({
  label,
  counted,
  value,
  note,
}: {
  readonly label: string;
  readonly counted: Tally;
  readonly value: (total: number) => string;
  readonly note?: ReactNode;
}) => (
  <div className="border-border border-t pt-3">
    <dt className="text-ink-muted text-sm">{label}</dt>
    <dd className="mt-1">
      <span className="block font-display text-2xl text-ink tabular-nums">
        {counted.measured === 0 ? 'Not measured' : value(counted.total)}
      </span>
      <span className="mt-1 block text-ink-faint text-sm">
        {counted.measured === 0
          ? `on ${journalCountLabel(counted.missing, 'day')}`
          : coverage(counted)}
        {note}
      </span>
    </dd>
  </div>
);

export const ReviewTotals = ({
  metrics,
}: {
  readonly metrics: ReadonlyArray<DayMetrics>;
}) => {
  const active = tally(metrics, (day) => day.activeMinutes);
  const focus = tally(metrics, (day) => day.focusMinutes);
  // The share is read only from days that measured both, so a day missing one
  // of them cannot tilt it.
  const split = metrics.filter(
    (day) => day.focusMinutes !== null && day.activeMinutes !== null,
  );
  const splitActive = tally(split, (day) => day.activeMinutes);
  const share =
    splitActive.total === 0
      ? undefined
      : Math.round(
          (tally(split, (day) => day.focusMinutes).total / splitActive.total) *
            percent,
        );
  const appointments = tally(metrics, (day) => day.appointmentMinutes);
  const awayInAppointments = tally(
    metrics,
    (day) => day.appointmentOffScreenMinutes,
  );

  return (
    <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      <Figure
        counted={active}
        label="At the screen"
        note={
          active.measured === 0
            ? null
            : `, ${durationLabel(Math.round(active.total / active.measured))} a day`
        }
        value={durationLabel}
      />
      <Figure
        counted={focus}
        label="Focused"
        note={share === undefined ? null : `, ${share}% of the screen time`}
        value={durationLabel}
      />
      <Figure
        counted={tally(metrics, (day) => day.offComputerMinutes)}
        label="Off-computer work"
        value={durationLabel}
      />
      <Figure
        counted={appointments}
        label="In appointments"
        note={
          awayInAppointments.measured === 0 ||
          awayInAppointments.measured !== appointments.measured
            ? null
            : `, ${durationLabel(awayInAppointments.total)} of it away from the screen`
        }
        value={durationLabel}
      />
      <Figure
        counted={tally(metrics, (day) => day.landedPrs)}
        label="Pull requests landed"
        value={journalNumberLabel}
      />
      <Figure
        counted={tally(metrics, sentMailCount)}
        label="Mail sent"
        value={journalNumberLabel}
      />
    </dl>
  );
};
