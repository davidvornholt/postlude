/**
 * The timeline of a sample day's report: the day in parts, screen time by
 * area, a few agent threads, and appointments, pull requests and mail, made
 * up within the day's first and last activity. Every name in it is made up
 * too, the mail subjects and window titles among them. A stretch of screen
 * time counts as focus by the activity summary's rule when it is long
 * enough, since a sample stretch has no breaks.
 */

import { isoInstantAt } from '../day-report-format.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import type {
  TimelineBlock,
  TimelineGroup,
  TimelineMark,
  TimelineRow,
} from '../schemas/day-report-timeline.ts';
import { type Random, type Span, within } from './sample-random.ts';

const minuteMs = 60_000;
const minutesPerHour = 60;
const pullRequestNumbers: Span = { low: 100, high: 400 };
/** Where the first thread starts, and how far apart the threads start, as shares of the day. */
const firstThreadShare = 0.1;
const threadSpacing = 0.22;
const runMinutes: Span = { low: 25, high: 80 };
const mostAppointments = 2;
const firstAppointmentShare = 0.2;
const appointmentSpacing = 0.4;
/** Where in a run its prompts are, as shares of it: at its start and halfway. */
const halfway = 0.5;
const promptShares = [0, halfway] as const;

/** A sample day's span and the clock its instants are written in. */
export type SampleSpan = {
  readonly start: number;
  readonly end: number;
  readonly offsetMinutes: number;
  readonly random: Random;
};

const at = (span: SampleSpan, ms: number): string =>
  isoInstantAt(ms, span.offsetMinutes);

/** A moment in the span, `share` of the way through it. */
const through = (span: SampleSpan, share: number): number =>
  span.start +
  Math.round(((span.end - span.start) * share) / minuteMs) * minuteMs;

/** Where the day's parts begin, as shares of its span, and what they are called. */
const intoTheWork = 0.38;
const wrappingUp = 0.72;
const partShares = [0, intoTheWork, wrappingUp] as const;
export const partTitles = [
  'A slow start',
  'Into the work',
  'Wrapping up',
] as const;

export type SamplePart = {
  readonly title: string;
  readonly start: string;
  readonly end: string;
};

export const samplePartsOf = (span: SampleSpan): ReadonlyArray<SamplePart> =>
  partShares.map((share, index) => ({
    title: partTitles[index] ?? `Part ${index + 1}`,
    start: at(span, through(span, share)),
    end: at(span, through(span, partShares[index + 1] ?? 1)),
  }));

/** The apps a made-up area was spent in, and the title of a window in each. */
const appsByArea: Readonly<
  Record<string, ReadonlyArray<readonly [string, string]>>
> = {
  code: [
    ['Editor', 'report.ts - Editor'],
    ['Terminal', 'Build - Terminal'],
    ['Browser', 'Pull request - Browser'],
  ],
  writing: [
    ['Notes', 'Garden plan - Notes'],
    ['Browser', 'Thesaurus - Browser'],
  ],
  meetings: [
    ['Video calls', 'Weekly planning - Video calls'],
    ['Calendar', 'This week - Calendar'],
  ],
  mail: [
    ['Mail', 'Inbox - Mail'],
    ['Chat', 'Team - Chat'],
  ],
  reading: [
    ['Reader', 'Field guide - Reader'],
    ['Browser', 'Wiki - Browser'],
  ],
};

const stretchesPerArea = 4;
/** The summary's focus rule: a block needs this much time at the computer. */
const focusNeedsMinutes = 25;
/** The project a made-up coding stretch went to. */
const codeProject = 'postlude';

type SampleArea = {
  readonly id: string;
  readonly label: string;
  readonly minutes: number;
};

/** A stretch's apps, the first used most, as its minutes split between them. */
const appsOf = (
  apps: ReadonlyArray<readonly [string, string]>,
  minutes: number,
): ReadonlyArray<readonly [string, string, number]> => {
  const share = Math.floor(minutes / apps.length);
  return apps.map(([name, title], index) => [
    name,
    title,
    index === 0 ? minutes - share * (apps.length - 1) : share,
  ]);
};

/** A stretch of an area: when it was, and its minutes on screen. */
type SampleStretch = {
  readonly start: string;
  readonly end: string;
  readonly minutes: number;
};

/** A stretch of an area, whether it counted as focus where focus was measured, and its focus block. */
const stretchMarks = (
  area: SampleArea,
  { start, end, minutes }: SampleStretch,
  apps: ReadonlyArray<readonly [string, string]>,
  focusMeasured: boolean,
): ReadonlyArray<TimelineMark> => {
  const used = appsOf(apps, minutes).filter(([, , share]) => share > 0);
  const counted = minutes >= focusNeedsMinutes;
  const focus = counted
    ? { status: 'counted' as const, start, end, minutes }
    : { status: 'short' as const, minutes, needs: focusNeedsMinutes };
  return [
    {
      kind: 'screen',
      start,
      end,
      minutes,
      apps: used.map(([name, , share]) => ({ name, minutes: share })),
      windows: used.map(([, title]) => title),
      ...(area.id === 'code' ? { projects: [codeProject] } : {}),
      ...(focusMeasured ? { focus } : {}),
    },
    ...(focusMeasured && counted
      ? [{ kind: 'focus' as const, start, end, minutes }]
      : []),
  ];
};

/** An area's minutes as a few stretches spread over the day. */
const screenRow = (
  span: SampleSpan,
  area: SampleArea,
  focusMeasured: boolean,
): TimelineRow => {
  const length = Math.max(1, Math.round(area.minutes / stretchesPerArea));
  const room = Math.max(0, (span.end - span.start) / minuteMs - length);
  const apps = appsByArea[area.id] ?? [['Browser', 'Start page - Browser']];
  const marks: Array<TimelineMark> = Array.from(
    { length: stretchesPerArea },
    (_, index) => {
      const lane = room / stretchesPerArea;
      const offset = Math.round(lane * index + span.random() * lane);
      const start = span.start + offset * minuteMs;
      return stretchMarks(
        area,
        {
          start: at(span, start),
          end: at(span, start + length * minuteMs),
          minutes: length,
        },
        apps.slice(0, 1 + (index % apps.length)),
        focusMeasured,
      );
    },
  ).flat();
  return { label: area.label, total: { minutes: area.minutes }, marks };
};

const threads = [
  { label: 'Draw the report natively', note: 'Coding' },
  { label: 'Tidy the sample data', note: 'Coding' },
  { label: 'Read up on the axis', note: 'Reading' },
] as const;

const pullRequestTitles = [
  'Draw the day report from its document',
  'Keep the axis labels apart on a phone',
  'Give the sample days a timeline',
  'Name the timeline marks in the legend',
] as const;

/** What each made-up pull request changed, as its card says it. */
const pullRequestSummaries = [
  'The day report is now drawn from the document /wrap stores.',
  'The hours under the timeline no longer run into each other on a phone.',
  'Sample days now have a timeline, so the report can be tried without data.',
  'The legend now names each kind of mark the timeline draws.',
] as const;

const mailSubjects = [
  'Garden plan for Saturday',
  'Re: The shared calendar',
  'Notes from the planning call',
  'Invoice for October',
] as const;

/** A sample pull request, with a number that is the same for the same day. */
export type SamplePullRequest = {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly at: string;
};

export const samplePullRequestsOf = (
  span: SampleSpan,
  count: number,
): ReadonlyArray<SamplePullRequest> =>
  Array.from({ length: count }, (_, index) => ({
    repository: index % 2 === 0 ? 'postlude' : 'agent-skills',
    number: within(span.random, pullRequestNumbers),
    title: pullRequestTitles[index % pullRequestTitles.length] ?? 'A change',
    summary:
      pullRequestSummaries[index % pullRequestSummaries.length] ??
      'It changed the day report.',
    at: at(span, through(span, (index + 1) / (count + 1))),
  }));

/** Runs and prompts in each made-up thread; the first run lands the first pull request. */
const threadRows = (
  span: SampleSpan,
  landed: ReadonlyArray<SamplePullRequest>,
): ReadonlyArray<TimelineRow> =>
  threads.map((thread, index) => {
    const start = through(span, firstThreadShare + index * threadSpacing);
    const minutes = within(span.random, runMinutes);
    const end = start + minutes * minuteMs;
    const [first] = landed;
    const run: TimelineMark = {
      kind: 'run',
      start: at(span, start),
      end: at(span, end),
      ...(index === 0 && first !== undefined
        ? {
            pullRequests: [
              {
                repository: first.repository,
                number: first.number,
                title: first.title,
              },
            ],
          }
        : {}),
    };
    const prompts: Array<TimelineMark> = promptShares.map((share, prompt) => ({
      kind: 'prompt',
      at: at(span, start + Math.round(share * minutes) * minuteMs),
      ...(index === 1 && prompt === 1 ? { fromPhone: true } : {}),
    }));
    return { label: thread.label, note: thread.note, marks: [run, ...prompts] };
  });

const appointmentTitles = ['Planning call', 'Review', 'Dentist'] as const;

const appointmentMarks = (
  span: SampleSpan,
  minutes: number,
): ReadonlyArray<TimelineMark> => {
  const count =
    minutes === 0
      ? 0
      : Math.min(mostAppointments, 1 + Math.floor(minutes / minutesPerHour));
  return Array.from({ length: count }, (_, index) => {
    const start = through(
      span,
      firstAppointmentShare + index * appointmentSpacing,
    );
    return {
      kind: 'appointment',
      title: appointmentTitles[index] ?? 'Appointment',
      start: at(span, start),
      end: at(span, start + Math.round(minutes / count) * minuteMs),
    };
  });
};

const mailMarks = (
  span: SampleSpan,
  metrics: DayMetrics,
): ReadonlyArray<TimelineMark> =>
  metrics.sentMails.flatMap(({ mailbox, count }) =>
    Array.from({ length: count ?? 0 }, (_, index) => ({
      kind: 'mail' as const,
      at: at(span, through(span, span.random())),
      mailbox,
      subject: mailSubjects[index % mailSubjects.length] ?? 'A note',
    })),
  );

const areasOf = (metrics: DayMetrics) =>
  metrics.categories.length === 0
    ? [
        {
          id: 'code',
          label: 'At the computer',
          minutes: metrics.activeMinutes ?? 0,
        },
      ]
    : metrics.categories.map((category) => ({
        ...category,
        minutes: category.minutes ?? 0,
      }));

export const sampleTimelineOf = (
  span: SampleSpan,
  metrics: DayMetrics,
  landed: ReadonlyArray<SamplePullRequest>,
): TimelineBlock => {
  const parts = samplePartsOf(span);
  const groups: Array<TimelineGroup> = [
    {
      title: 'The day in parts',
      rows: [
        {
          label: 'Parts',
          marks: parts.map((part, index) => ({
            kind: 'part',
            number: index + 1,
            title: part.title,
            start: part.start,
            end: part.end,
          })),
        },
      ],
    },
    {
      title: 'Your screen time by area',
      rows: areasOf(metrics)
        .filter((area) => area.minutes > 0)
        .map((area) => screenRow(span, area, metrics.focusMinutes !== null)),
    },
    { title: 'Threads · Postlude', rows: threadRows(span, landed) },
    {
      title: 'Appointments, pull requests and mail',
      rows: [
        {
          label: 'Calendar',
          marks: appointmentMarks(span, metrics.appointmentMinutes ?? 0),
        },
        {
          label: 'Pull requests',
          marks: landed.map(
            ({ repository, number, title, summary, at: landedAt }) => ({
              kind: 'pullRequest',
              repository,
              number,
              title,
              summary,
              at: landedAt,
            }),
          ),
        },
        { label: 'Sent mail', marks: mailMarks(span, metrics) },
      ],
    },
  ];
  const unread = metrics.coverage
    .filter(({ status }) => status !== 'complete')
    .map(
      ({ source }) =>
        `The ${source} source wasn't read, so its marks are missing.`,
    );
  return {
    kind: 'timeline',
    heading: 'Timeline',
    groups,
    ...(unread.length === 0 ? {} : { notes: unread }),
  };
};
