/**
 * What a timeline mark's card says: what the mark is, when, and what it
 * holds. It says only what the mark holds, which by the schema is never a
 * word of a prompt or a conversation.
 *
 * A screen-time card answers why its stretch counted as focus or didn't, by
 * the activity summary's rule: a focus block lasts while every switch away
 * from its area is shorter than two minutes, and needs 25 minutes at the
 * computer. Its bar joins those short switches, so the card gives the minutes
 * on screen within the stretch when they are fewer than the stretch is long.
 */

import {
  clockOf,
  clockRange,
  minutesBetween,
  minutesText,
} from './day-report-format.ts';
import type {
  ScreenFocus,
  TimelineMark,
  TimelineRow,
} from './schemas/day-report-timeline.ts';

/** The summary's switch grace: a switch away this long ends a focus block. */
const switchGraceMinutes = 2;
const millisecondsPerMinute = 60_000;

export type MarkCard = {
  readonly title: string;
  readonly lines: ReadonlyArray<string>;
};

const span = (start: string, end: string): string =>
  `${clockRange(start, end)} · ${minutesText(minutesBetween(start, end))}`;

/** Whole minutes from start to end, cut down like a stretch's screen time. */
const wholeMinutesBetween = (start: string, end: string): number =>
  Math.floor((Date.parse(end) - Date.parse(start)) / millisecondsPerMinute);

type PullRequest = {
  readonly repository: string;
  readonly number?: number;
  readonly title: string;
};

const pullRequestName = ({ repository, number }: PullRequest): string =>
  number === undefined ? repository : `${repository} #${number}`;

const pullRequestText = (pr: PullRequest): string =>
  `${pullRequestName(pr)}: ${pr.title}`;

/** A row's label as its card names it, with the row's note where it has one. */
const rowName = (row: TimelineRow): string =>
  row.note === undefined ? row.label : `${row.label} · ${row.note}`;

const withoutBreak = `without a break of ${switchGraceMinutes} min or more`;

const focusLine = (
  focus: ScreenFocus,
  stretch: { readonly start: string; readonly end: string },
): string => {
  switch (focus.status) {
    case 'counted': {
      const whole =
        Date.parse(focus.start) <= Date.parse(stretch.start) &&
        Date.parse(focus.end) >= Date.parse(stretch.end);
      const at = `${minutesText(focus.minutes)} at the computer ${withoutBreak}`;
      return whole
        ? `Focus: ${at}`
        : `Focus from ${clockRange(focus.start, focus.end)}: ${at}`;
    }
    case 'short':
      return `Not focus: ${minutesText(focus.minutes)} at the computer ${withoutBreak}, and focus needs ${minutesText(focus.needs)}`;
    case 'noArea':
      return 'Not focus: time in no area never counts';
    default:
      return focus.within === undefined
        ? 'Not counted as focus'
        : `Not focus: its start counted toward focus in ${focus.within}`;
  }
};

const namesLine = (
  label: string,
  names: ReadonlyArray<string> | undefined,
  more = 0,
): ReadonlyArray<string> =>
  names === undefined || names.length === 0
    ? []
    : [`${label}: ${names.join(', ')}${more === 0 ? '' : ` and ${more} more`}`];

const screenCard = (
  mark: Extract<TimelineMark, { kind: 'screen' }>,
  row: TimelineRow,
): MarkCard => {
  const within = wholeMinutesBetween(mark.start, mark.end);
  const onScreen =
    within > mark.minutes
      ? `${minutesText(mark.minutes)} of ${minutesText(within)} on screen`
      : `${minutesText(mark.minutes)} on screen`;
  const projects = mark.projects ?? [];
  return {
    title: `Screen time · ${row.label}`,
    lines: [
      `${clockRange(mark.start, mark.end)} · ${onScreen}`,
      ...(mark.focus === undefined ? [] : [focusLine(mark.focus, mark)]),
      ...namesLine(projects.length > 1 ? 'Projects' : 'Project', projects),
      ...namesLine('Prompted in', mark.threads, mark.moreThreads),
      ...namesLine(
        'Apps',
        mark.apps?.map((app) => `${app.name} ${minutesText(app.minutes)}`),
      ),
      ...(mark.windows === undefined || mark.windows.length === 0
        ? []
        : [`Windows: ${mark.windows.join('; ')}`]),
    ],
  };
};

export const cardOf = (mark: TimelineMark, row: TimelineRow): MarkCard => {
  switch (mark.kind) {
    case 'part':
      return {
        title:
          mark.title === undefined
            ? `Part ${mark.number}`
            : `Part ${mark.number} · ${mark.title}`,
        lines: [span(mark.start, mark.end)],
      };
    case 'screen':
      return screenCard(mark, row);
    case 'focus':
      return {
        title: `Focus · ${row.label}`,
        lines: [
          mark.minutes === undefined
            ? span(mark.start, mark.end)
            : `${clockRange(mark.start, mark.end)} · ${minutesText(mark.minutes)} at the computer`,
        ],
      };
    case 'run':
      return {
        title: `Agent running · ${rowName(row)}`,
        lines: [
          span(mark.start, mark.end),
          ...(mark.pullRequests ?? []).map(
            (pr) => `Landed ${pullRequestText(pr)}`,
          ),
        ],
      };
    case 'prompt':
      return {
        title: mark.fromPhone === true ? 'Prompt from the phone' : 'Prompt',
        lines: [`${clockOf(mark.at)} · ${rowName(row)}`],
      };
    case 'appointment':
      return { title: mark.title, lines: [span(mark.start, mark.end)] };
    case 'pullRequest':
      return {
        title: pullRequestName(mark),
        lines: [
          mark.title,
          ...(mark.summary === undefined ? [] : [mark.summary]),
          `Landed at ${clockOf(mark.at)}`,
        ],
      };
    default:
      return {
        title: 'Mail sent',
        lines: [
          mark.mailbox === undefined
            ? clockOf(mark.at)
            : `${clockOf(mark.at)} · ${mark.mailbox}`,
          ...(mark.subject === undefined ? [] : [mark.subject]),
        ],
      };
  }
};

/** A card as one sentence, for the live region that reads it out. */
export const cardText = (card: MarkCard): string =>
  [card.title, ...card.lines].join('. ');
