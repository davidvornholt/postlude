/**
 * The day log /wrap would have written beside a made-up day's report: one
 * paragraph per stretch of the day, each starting with its time range, in the
 * order the metrics' categories list them.
 *
 * It is built from the metrics alone and takes no random draws, so the rest of
 * the sample stays the same. A version 1 day has no categories, so its log is
 * one paragraph for the whole active time.
 */

import type { DayMetrics } from '../schemas/day-metrics.ts';

const minutesPerHour = 60;
const lastMinuteOfDay = 24 * minutesPerHour - 1;
/** Where a log starts when the metrics have no first activity. */
const defaultStartHour = 9;
const localClock = /T(?<hours>\d{2}):(?<minutes>\d{2})/u;
const dayOfMonthPattern = /-(?<day>\d{2})$/u;

/** What the log says was done in each category, varied by the day of the month. */
const activities: Readonly<Record<string, ReadonlyArray<string>>> = {
  code: [
    'Worked on the importer: split the parser into smaller steps and ran its tests.',
    'Fixed the calendar sync after a timezone bug and wrote a regression test.',
    'Reviewed two pull requests for the search page and answered the comments.',
  ],
  writing: [
    'Drafted the project notes for the next milestone.',
    'Rewrote the onboarding guide and trimmed the setup section.',
  ],
  meetings: [
    'Weekly planning call, then a short call about the release.',
    'Design review of the settings page.',
  ],
  mail: [
    'Answered mail and the team chat.',
    'Sorted the inbox and replied to the open questions.',
  ],
  reading: [
    'Read documentation on database indexes.',
    'Read an article on writing habits and took notes.',
  ],
};

const fallbackActivity = 'Worked at the computer.';

const pad = (value: number) => String(value).padStart(2, '0');

const clockOf = (minutes: number) => {
  const capped = Math.min(minutes, lastMinuteOfDay);
  return `${pad(Math.floor(capped / minutesPerHour))}:${pad(capped % minutesPerHour)}`;
};

/** The local minute of the day an ISO time such as `2026-10-30T08:12:00+01:00` names. */
const localMinuteOf = (iso: string) => {
  const clock = localClock.exec(iso)?.groups;
  return (
    Number(clock?.hours ?? 0) * minutesPerHour + Number(clock?.minutes ?? 0)
  );
};

const activityFor = (id: string, dayOfMonth: number) => {
  const choices = activities[id] ?? [];
  return choices[dayOfMonth % Math.max(choices.length, 1)] ?? fallbackActivity;
};

export const sampleDayLog = (metrics: DayMetrics): string => {
  const start =
    metrics.firstActivityAt === null
      ? defaultStartHour * minutesPerHour
      : localMinuteOf(metrics.firstActivityAt);
  const dayOfMonth = Number(
    dayOfMonthPattern.exec(metrics.day)?.groups?.day ?? 0,
  );
  const stretches =
    metrics.categories.length === 0
      ? [{ id: '', minutes: metrics.activeMinutes }]
      : metrics.categories;
  const paragraphs = stretches.reduce<{
    readonly at: number;
    readonly lines: ReadonlyArray<string>;
  }>(
    ({ at, lines }, { id, minutes }) => {
      const end = at + (minutes ?? 0);
      return {
        at: end,
        lines: [
          ...lines,
          `${clockOf(at)}–${clockOf(end)} ${activityFor(id, dayOfMonth)}`,
        ],
      };
    },
    { at: start, lines: [] },
  ).lines;
  return paragraphs.join('\n\n');
};
