/**
 * Made-up weeks and months for the review pages, for tests and fixtures only.
 * They hold every case the pages have to tell apart: a change of metrics
 * version, a day without a report, numbers that were not measured, days
 * without a rating, and days still to come.
 */

import { calendarWeekdayIndex } from '../calendar.ts';
import { periodDates } from '../review-period.ts';
import type { ReviewDay, ReviewView } from '../review-view.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { sampleDayMetrics } from './evening-view.ts';

export const unratedDay = (date: string): ReviewDay => ({
  date,
  energy: null,
  progress: null,
  repeatDay: null,
  closed: false,
  metrics: null,
});

const measured = (
  date: string,
  changes: Partial<DayMetrics> = {},
): DayMetrics => ({ ...sampleDayMetrics(date), ...changes });

/** The week of October 26, 2026, looked at on its Friday. */
export const sampleReviewWeek: ReviewView = {
  period: { kind: 'week', start: '2026-10-26' },
  today: '2026-10-30',
  days: [
    {
      date: '2026-10-26',
      energy: 'fresh',
      progress: 'a_lot',
      repeatDay: 'yes',
      closed: true,
      metrics: measured('2026-10-26', {
        metricsVersion: 1,
        activeMinutes: 380,
        focusMinutes: 250,
        scatteredMinutes: 130,
      }),
    },
    {
      date: '2026-10-27',
      energy: 'okay',
      progress: 'solid',
      repeatDay: 'partly',
      closed: true,
      metrics: measured('2026-10-27'),
    },
    {
      date: '2026-10-28',
      energy: 'drained',
      progress: 'little',
      repeatDay: 'no',
      closed: true,
      metrics: null,
    },
    {
      ...unratedDay('2026-10-29'),
      energy: 'okay',
      metrics: measured('2026-10-29', {
        activeMinutes: 505,
        focusMinutes: null,
        scatteredMinutes: null,
        sentMails: [
          { mailbox: 'Work', count: 2 },
          { mailbox: 'Home', count: null },
        ],
      }),
    },
    {
      ...unratedDay('2026-10-30'),
      metrics: measured('2026-10-30', {
        activeMinutes: null,
        focusMinutes: null,
        scatteredMinutes: null,
      }),
    },
    unratedDay('2026-10-31'),
    unratedDay('2026-11-01'),
  ],
};

const energies = ['fresh', 'okay', 'okay', 'drained'] as const;
const progresses = ['solid', 'a_lot', 'little', 'solid', 'solid'] as const;
const repeats = ['yes', 'partly', 'yes', 'no', 'partly', 'yes'] as const;
const minutesStep = 37;
const minutesSpread = 300;
const minutesFloor = 150;
const reportEvery = 6;
const saturdayIndex = 5;
const focusShare = 0.6;

/**
 * October 2026 looked at on its 30th, in one metrics version, with every sixth
 * day missing its report and the weekends left unrated.
 */
export const sampleReviewMonth: ReviewView = {
  period: { kind: 'month', month: '2026-10' },
  today: '2026-10-30',
  days: periodDates({ kind: 'month', month: '2026-10' }).map((date, index) => {
    if (date > '2026-10-30') {
      return unratedDay(date);
    }
    const weekend = calendarWeekdayIndex(date) >= saturdayIndex;
    const active = minutesFloor + ((index * minutesStep) % minutesSpread);
    const focus = Math.round(active * focusShare);
    return {
      date,
      energy: weekend ? null : (energies[index % energies.length] ?? null),
      progress: weekend
        ? null
        : (progresses[index % progresses.length] ?? null),
      repeatDay: weekend ? null : (repeats[index % repeats.length] ?? null),
      closed: !weekend,
      metrics:
        index % reportEvery === reportEvery - 1
          ? null
          : measured(date, {
              activeMinutes: active,
              focusMinutes: focus,
              scatteredMinutes: active - focus,
            }),
    };
  }),
};
