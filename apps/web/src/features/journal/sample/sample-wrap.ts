/**
 * What /wrap would have stored for a made-up day: its metrics, in the shape
 * `DayMetricsSchema` holds them to, and the sample report that shows them.
 *
 * Version 1 is an older way of measuring the same day that didn't split time
 * into categories or count short stretches, so the review pages have a
 * change of version to show.
 */

import type { DayMetrics } from '../schemas/day-metrics.ts';
import { isoAt, isWeekend } from './sample-clock.ts';
import {
  between,
  chance,
  type Random,
  type Span,
  within,
} from './sample-random.ts';

export const reportModel = 'Postlude preview sample';

/** The categories version 2 splits active time into, and their shares of it. */
const categoryShares = [
  { id: 'code', label: 'Coding', share: 0.38 },
  { id: 'writing', label: 'Writing', share: 0.14 },
  { id: 'meetings', label: 'Meetings', share: 0.18 },
  { id: 'mail', label: 'Mail and chat', share: 0.12 },
  { id: 'reading', label: 'Reading', share: 0.1 },
] as const;

const shareSpread = 0.4;
const calendarGapChance = 0.12;
const mailGapChance = 0.08;

type Ranges = {
  readonly startHour: Span;
  readonly endHour: Span;
  readonly active: Span;
  readonly prs: Span;
  readonly mails: Span;
};

const workday: Ranges = {
  startHour: { low: 7, high: 9 },
  endHour: { low: 17, high: 21 },
  active: { low: 280, high: 560 },
  prs: { low: 0, high: 5 },
  mails: { low: 2, high: 14 },
};
const weekend: Ranges = {
  startHour: { low: 9, high: 11 },
  endHour: { low: 14, high: 21 },
  active: { low: 30, high: 180 },
  prs: { low: 0, high: 1 },
  mails: { low: 0, high: 3 },
};
/** Shares of the active minutes, in percent. */
const focusShare: Span = { low: 35, high: 60 };
const scatteredShare: Span = { low: 10, high: 30 };
const offComputer: Span = { low: 60, high: 260 };
const appointments: Span = { low: 0, high: 150 };
const percent = 100;
const lastMinute = 59;

const shareOf = (random: Random, total: number, share: Span) =>
  Math.round((total * within(random, share)) / percent);

const categoriesOf = (random: Random, activeMinutes: number) =>
  categoryShares.map(({ id, label, share }) => ({
    id,
    label,
    minutes: Math.round(
      activeMinutes * share * (1 - shareSpread / 2 + random() * shareSpread),
    ),
  }));

/** A source /wrap reads that can be out of reach on a day. */
export type MetricsSource = 'calendar' | 'mail';

export type MetricsInput = {
  readonly random: Random;
  readonly date: string;
  /** The zone the journal keeps its days in. */
  readonly timeZone: string;
  readonly metricsVersion: 1 | 2;
  /** The sources out of reach that day. Left out, a source now and then is. */
  readonly unreachable?: ReadonlyArray<MetricsSource> | undefined;
};

/** Metrics for `date`, as /wrap would have measured it. */
export const sampleDayMetrics = ({
  random,
  date,
  timeZone,
  metricsVersion,
  unreachable,
}: MetricsInput): DayMetrics => {
  const ranges = isWeekend(date) ? weekend : workday;
  const activeMinutes = within(random, ranges.active);
  const calendarRead =
    unreachable === undefined
      ? !chance(random, calendarGapChance)
      : !unreachable.includes('calendar');
  const mailRead =
    unreachable === undefined
      ? !chance(random, mailGapChance)
      : !unreachable.includes('mail');
  const appointmentMinutes = calendarRead ? within(random, appointments) : null;
  return {
    metricsVersion,
    day: date,
    activeMinutes,
    firstActivityAt: isoAt(
      date,
      within(random, ranges.startHour),
      between(random, 0, lastMinute),
      timeZone,
    ),
    lastActivityAt: isoAt(
      date,
      within(random, ranges.endHour),
      between(random, 0, lastMinute),
      timeZone,
    ),
    focusMinutes: shareOf(random, activeMinutes, focusShare),
    scatteredMinutes:
      metricsVersion === 1
        ? null
        : shareOf(random, activeMinutes, scatteredShare),
    categories: metricsVersion === 1 ? [] : categoriesOf(random, activeMinutes),
    offComputerMinutes: within(random, offComputer),
    appointmentMinutes,
    appointmentOffScreenMinutes:
      appointmentMinutes === null
        ? null
        : Math.round(appointmentMinutes * random()),
    landedPrs: within(random, ranges.prs),
    sentMails: [
      {
        mailbox: 'Work',
        count: mailRead ? within(random, ranges.mails) : null,
      },
      {
        mailbox: 'Personal',
        count: mailRead ? within(random, ranges.mails) : null,
      },
    ],
    coverage: [
      { source: 'activitywatch', status: 'complete' },
      { source: 'calendar', status: calendarRead ? 'complete' : 'unreachable' },
      { source: 'mail', status: mailRead ? 'complete' : 'unreachable' },
    ],
  };
};
