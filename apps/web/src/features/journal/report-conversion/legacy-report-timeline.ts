/**
 * The timeline of an old report page as a timeline block.
 *
 * The page drew each mark at a share of its axis: `left` and `width` in
 * percent, to three places, of `--hours` hours from the axis's first label.
 * That is exact to well under a minute, so each mark's times are read back
 * from where it sat, and what the mark said on hover fills in the rest: an
 * appointment's title, a pull request's repository, number, and title, the
 * minutes of screen time in a stretch. A mail mark said only "Mail sent",
 * and keeps only its time.
 *
 * Postlude draws the legend, the hour labels, and the dividers between parts
 * itself, so the page's are not read. A row of screen time gets its area's
 * total beside its label, as /wrap now gives one.
 */

import { minutesBetween } from '../day-report-format.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import type {
  TimelineBlock,
  TimelineGroup,
  TimelineMark,
  TimelineRow,
} from '../schemas/day-report-timeline.ts';
import {
  attributeOf,
  childElements,
  classesOf,
  findElement,
  type HtmlElement,
  hasClass,
  is,
  textOf,
} from './html-tree.ts';
import { berlinInstant, journalClockMs } from './legacy-clock.ts';
import { labelOf } from './legacy-report-text.ts';
import { minutesOf } from './legacy-report-tiles.ts';

const hourMs = 3_600_000;
const percent = 100;
const marksPerRow = 2000;
const rowsPerGroup = 80;
const groupsPerTimeline = 12;
const notesPerTimeline = 8;

type Axis = { readonly start: number; readonly hours: number };

const hoursPattern = /--hours:\s*(?<hours>\d+(?:\.\d+)?)/u;
const leftPattern = /left:\s*(?<left>-?\d+(?:\.\d+)?)%/u;
const widthPattern = /width:\s*(?<width>\d+(?:\.\d+)?)%/u;

const axisOf = (timeline: HtmlElement, day: string): Axis | undefined => {
  const hours = Number(
    hoursPattern.exec(attributeOf(timeline, 'style') ?? '')?.groups?.hours,
  );
  const ticks = findElement(timeline, (element) =>
    is(element, 'span', 'tl-ticks'),
  );
  const first = ticks === undefined ? undefined : childElements(ticks)[0];
  const start =
    first === undefined ? undefined : journalClockMs(day, textOf(first));
  return start === undefined || !(hours > 0) ? undefined : { start, hours };
};

type Place = { readonly start: string; readonly end: string };

const placeOf = (mark: HtmlElement, axis: Axis): Place | undefined => {
  const style = attributeOf(mark, 'style') ?? '';
  const left = Number(leftPattern.exec(style)?.groups?.left);
  if (Number.isNaN(left)) {
    return undefined;
  }
  const width = Number(widthPattern.exec(style)?.groups?.width ?? 0);
  const at = (share: number): number =>
    axis.start + (share / percent) * axis.hours * hourMs;
  return {
    start: berlinInstant(at(left)),
    end: berlinInstant(at(left + width)),
  };
};

const clock = String.raw`\d{1,2}:\d{2}`;
const span = String.raw`${clock}\s*[–-]\s*${clock}`;
const lengthPattern = /\((?<length>[^()]+)\)$/u;
const appointmentPattern = new RegExp(
  String.raw`^(?<title>.+) · ${span}(?: \([^()]*\))?$`,
  'u',
);
const landedPattern = new RegExp(
  String.raw`^Landed (?<repository>.+?)#(?<number>\d+): (?<title>.+) · ${clock}$`,
  'u',
);
const earlyLandedPattern = new RegExp(
  `^(?<repository>[^:]+): (?<title>.+) · ${clock}$`,
  'u',
);
const partPattern = new RegExp(
  String.raw`^(?<number>\d+) · (?:(?<title>.+) · )?${span}$`,
  'u',
);

const pullRequestOf = (tip: string) => {
  const groups = (landedPattern.exec(tip) ?? earlyLandedPattern.exec(tip))
    ?.groups;
  const repository = labelOf(groups?.repository ?? '');
  const title = labelOf(groups?.title ?? '');
  const number = Number(groups?.number);
  return repository === undefined || title === undefined
    ? { repository: 'Pull request', title: labelOf(tip) ?? 'Landed' }
    : { repository, ...(number >= 1 ? { number } : {}), title };
};

const partOf = (
  mark: HtmlElement,
  tip: string,
  place: Place,
): TimelineMark | undefined => {
  const groups = partPattern.exec(tip)?.groups;
  const number = Number(textOf(mark) || groups?.number);
  const title = labelOf(groups?.title ?? '');
  return Number.isInteger(number) && number >= 1
    ? {
        kind: 'part',
        ...place,
        number,
        ...(title === undefined ? {} : { title }),
      }
    : undefined;
};

const kindOf = (mark: HtmlElement): string | undefined =>
  classesOf(mark).find((name) => name.startsWith('tl-') && name !== 'tl-mark');

/** One mark of a row, or nothing for a kind of mark Postlude doesn't draw. */
const markOf = (mark: HtmlElement, axis: Axis): TimelineMark | undefined => {
  const place = placeOf(mark, axis);
  if (place === undefined) {
    return undefined;
  }
  const tip = attributeOf(mark, 'data-tip') ?? '';
  const at = place.start;
  switch (kindOf(mark)) {
    case 'tl-screen':
      return {
        kind: 'screen',
        ...place,
        minutes:
          minutesOf(lengthPattern.exec(tip)?.groups?.length ?? '') ??
          minutesBetween(place.start, place.end),
      };
    case 'tl-focus':
      return { kind: 'focus', ...place };
    case 'tl-agent':
    case 'tl-run':
      return { kind: 'run', ...place };
    case 'tl-prompt':
      return { kind: 'prompt', at };
    case 'tl-phone':
      return { kind: 'prompt', at, fromPhone: true };
    case 'tl-appointment':
      return {
        kind: 'appointment',
        ...place,
        title:
          labelOf(appointmentPattern.exec(tip)?.groups?.title ?? '') ??
          'Appointment',
      };
    case 'tl-tick':
      return { kind: 'pullRequest', at, ...pullRequestOf(tip) };
    case 'tl-mail':
      return { kind: 'mail', at };
    case 'tl-part':
      return partOf(mark, tip, place);
    default:
      return undefined;
  }
};

const otherThreads = /^(?:One|\d+) other threads?$/u;
const tipLead = /^.* · /u;

/** A thread's project, from the label's hover text "title · project". */
const rowNoteOf = (label: HtmlElement, text: string): string | undefined => {
  const tip = attributeOf(label, 'data-tip');
  return tip === undefined || otherThreads.test(text) || !tip.includes(' · ')
    ? undefined
    : labelOf(tip.replace(tipLead, ''));
};

const rowOf = (row: HtmlElement, axis: Axis): TimelineRow | undefined => {
  const children = childElements(row);
  const label = children.find((child) => hasClass(child, 'tl-label'));
  const track = children.find((child) => hasClass(child, 'tl-track'));
  const text = label === undefined ? undefined : labelOf(textOf(label));
  if (label === undefined || text === undefined) {
    return undefined;
  }
  const marks = (track === undefined ? [] : childElements(track))
    .filter((mark) => hasClass(mark, 'tl-mark'))
    .flatMap((mark) => markOf(mark, axis) ?? [])
    .slice(0, marksPerRow);
  const note = rowNoteOf(label, text);
  return { label: text, ...(note === undefined ? {} : { note }), marks };
};

/** A row of screen time with its area's total, as the day's metrics have it. */
const withTotal = (
  row: TimelineRow,
  metrics: DayMetrics | null,
): TimelineRow => {
  const measured = metrics?.categories.find(
    (category) => category.label === row.label,
  )?.minutes;
  const minutes =
    typeof measured === 'number'
      ? measured
      : row.marks.reduce(
          (sum, mark) => sum + (mark.kind === 'screen' ? mark.minutes : 0),
          0,
        );
  return { ...row, total: { minutes } };
};

type OpenGroup = { readonly title: string; readonly rows: Array<TimelineRow> };

const isScreenGroup = (title: string): boolean =>
  title.startsWith('Your screen time');

/** A row of the timeline, added to the group it is drawn under. */
const addRow = (
  groups: Array<OpenGroup>,
  row: TimelineRow | undefined,
  metrics: DayMetrics | null,
  heading: string,
): void => {
  const group = groups.at(-1) ?? { title: heading, rows: [] };
  if (groups.length === 0) {
    groups.push(group);
  }
  if (row !== undefined) {
    group.rows.push(isScreenGroup(group.title) ? withTotal(row, metrics) : row);
  }
};

const groupsOf = (
  timeline: HtmlElement,
  axis: Axis,
  metrics: DayMetrics | null,
  heading: string,
): ReadonlyArray<TimelineGroup> => {
  const groups: Array<OpenGroup> = [];
  for (const child of childElements(timeline)) {
    if (is(child, 'p', 'tl-group')) {
      groups.push({ title: labelOf(textOf(child)) ?? heading, rows: [] });
    } else if (is(child, 'div', 'tl-row') && !hasClass(child, 'tl-axis')) {
      addRow(groups, rowOf(child, axis), metrics, heading);
    }
  }
  return groups
    .filter((group) => group.rows.length > 0)
    .map((group) => ({ ...group, rows: group.rows.slice(0, rowsPerGroup) }))
    .slice(0, groupsPerTimeline);
};

export type TimelineParts = {
  readonly heading: string;
  readonly timeline: HtmlElement | undefined;
  readonly notes: ReadonlyArray<string>;
};

/** The timeline block of a page's timeline, or nothing if its axis can't be read. */
export const timelineBlockOf = (
  parts: TimelineParts & {
    readonly day: string;
    readonly metrics: DayMetrics | null;
  },
): TimelineBlock | undefined => {
  const axis =
    parts.timeline === undefined
      ? undefined
      : axisOf(parts.timeline, parts.day);
  if (parts.timeline === undefined || axis === undefined) {
    return undefined;
  }
  const notes = parts.notes.slice(0, notesPerTimeline);
  return {
    kind: 'timeline',
    heading: parts.heading,
    groups: groupsOf(parts.timeline, axis, parts.metrics, parts.heading),
    ...(notes.length === 0 ? {} : { notes }),
  };
};

/** Whether a section of an old page is its timeline. */
export const isTimelineSection = (section: HtmlElement): boolean =>
  findElement(section, (element) => is(element, 'div', 'timeline')) !==
    undefined ||
  findElement(
    section,
    (element) => element.tag === 'h2' && textOf(element) === 'Timeline',
  ) !== undefined;
