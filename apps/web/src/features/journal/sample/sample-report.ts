/**
 * The /wrap report every sample day carries, as a report document composed
 * the way /wrap composes one: the measured blocks from the day's metrics and
 * a made-up timeline, and a few words about them. It says that it is sample
 * data, so nobody mistakes it for a measured day, and every name in it is
 * made up.
 */

import { minutesText, offsetMinutesOf } from '../day-report-format.ts';
import {
  sentMailTable,
  sourcesSection,
} from '../day-report-measured-blocks.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import type {
  ReportBlock,
  ReportDocument,
  TileValue,
} from '../schemas/day-report-blocks.ts';
import { reportDocumentVersion } from '../schemas/day-report-blocks.ts';
import type {
  TimelineBlock,
  TimelineMark,
} from '../schemas/day-report-timeline.ts';
import { seededRandom } from './sample-random.ts';
import {
  partTitles,
  type SamplePullRequest,
  type SampleSpan,
  samplePartsOf,
  samplePullRequestsOf,
  sampleTimelineOf,
} from './sample-report-timeline.ts';

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
/** A day without measured activity is drawn from nine to five. */
const fallbackStartHour = 9;
const fallbackEndHour = 17;

const minutes = (value: number | null): TileValue =>
  value === null ? null : { minutes: value };
const count = (value: number | null): TileValue =>
  value === null ? null : { count: value };

const spanOf = (metrics: DayMetrics): SampleSpan => {
  const day = Date.parse(`${metrics.day}T00:00:00Z`);
  const start =
    metrics.firstActivityAt === null
      ? day + fallbackStartHour * hourMs
      : Date.parse(metrics.firstActivityAt);
  const end =
    metrics.lastActivityAt === null
      ? day + fallbackEndHour * hourMs
      : Date.parse(metrics.lastActivityAt);
  return {
    start,
    end: Math.max(end, start + minuteMs),
    offsetMinutes:
      metrics.firstActivityAt === null
        ? 0
        : offsetMinutesOf(metrics.firstActivityAt),
    random: seededRandom(Number(metrics.day.replaceAll('-', ''))),
  };
};

type AgentTime = {
  /** Clock time with at least one run going. */
  readonly wallMinutes: number;
  /** Every run's minutes added up. */
  readonly runMinutes: number;
  readonly threads: number;
  /** The most runs going at once. */
  readonly peak: number;
};

/** What the timeline's runs add up to, by the clock and by thread. */
const agentTimeOf = (timeline: TimelineBlock): AgentTime => {
  const rows = timeline.groups.flatMap((group) => group.rows);
  const runs = rows.flatMap((row) =>
    row.marks.flatMap((mark: TimelineMark) =>
      mark.kind === 'run'
        ? [{ start: Date.parse(mark.start), end: Date.parse(mark.end) }]
        : [],
    ),
  );
  const changes = runs
    .flatMap(({ start, end }) => [
      { at: start, by: 1 },
      { at: end, by: -1 },
    ])
    .sort((a, b) => a.at - b.at || a.by - b.by);
  let going = 0;
  let peak = 0;
  let wall = 0;
  let since = 0;
  for (const { at, by } of changes) {
    if (going > 0) {
      wall += at - since;
    }
    going += by;
    peak = Math.max(peak, going);
    since = at;
  }
  return {
    wallMinutes: Math.round(wall / minuteMs),
    runMinutes: Math.round(
      runs.reduce((sum, { start, end }) => sum + end - start, 0) / minuteMs,
    ),
    threads: rows.filter((row) => row.marks.some((mark) => mark.kind === 'run'))
      .length,
    peak,
  };
};

const promptsOf = (timeline: TimelineBlock) => {
  const prompts = timeline.groups
    .flatMap((group) => group.rows)
    .flatMap((row) => row.marks)
    .flatMap((mark) => (mark.kind === 'prompt' ? [mark] : []));
  return {
    count: prompts.length,
    fromPhone: prompts.filter((prompt) => prompt.fromPhone === true).length,
  };
};

const sentMailsOf = (metrics: DayMetrics): number | null =>
  metrics.sentMails.some((mailbox) => mailbox.count === null)
    ? null
    : metrics.sentMails.reduce((sum, mailbox) => sum + (mailbox.count ?? 0), 0);

const tilesOf = (metrics: DayMetrics, timeline: TimelineBlock): ReportBlock => {
  const agents = agentTimeOf(timeline);
  const prompts = promptsOf(timeline);
  return {
    kind: 'tiles',
    tiles: [
      { label: 'Active', value: minutes(metrics.activeMinutes) },
      { label: 'Focus', value: minutes(metrics.focusMinutes) },
      {
        label: 'Agent time',
        value: { minutes: agents.wallMinutes },
        note: [
          `${minutesText(agents.runMinutes)} across ${agents.threads} threads · up to ${agents.peak} at once`,
        ],
      },
      {
        label: 'Prompts',
        value: { count: prompts.count },
        note: [`${prompts.fromPhone} from the phone`],
      },
      { label: 'In appointments', value: minutes(metrics.appointmentMinutes) },
      { label: 'Pull requests landed', value: count(metrics.landedPrs) },
      { label: 'Mail sent', value: count(sentMailsOf(metrics)) },
    ],
  };
};

const partTexts = [
  'Mail first, then a slow look at what the day should hold.',
  'The longest stretch of the day went into one change, with an agent alongside.',
  'Reviews, a last pull request, and the notes for tomorrow.',
] as const;

const partsOf = (span: SampleSpan): ReportBlock => ({
  kind: 'parts',
  parts: samplePartsOf(span).map((part, index) => ({
    ...part,
    text: [[partTexts[index] ?? 'More of the same.']],
  })),
});

const appointmentsSection = (
  timeline: TimelineBlock,
): ReadonlyArray<ReportBlock> => {
  const appointments = timeline.groups
    .flatMap((group) => group.rows)
    .flatMap((row) => row.marks)
    .flatMap((mark) => (mark.kind === 'appointment' ? [mark] : []));
  return appointments.length === 0
    ? []
    : [
        {
          kind: 'section',
          heading: 'Appointments',
          blocks: [
            {
              kind: 'list',
              items: appointments.map(({ title, start, end }) => ({
                text: [title ?? 'Appointment'],
                time: { start, end },
              })),
            },
          ],
        },
      ];
};

const pullRequestsSection = (
  landed: ReadonlyArray<SamplePullRequest>,
): ReadonlyArray<ReportBlock> =>
  landed.length === 0
    ? []
    : [
        {
          kind: 'section',
          heading: 'Pull requests landed',
          note: `${landed.length} landed`,
          collapsed: true,
          blocks: [
            {
              kind: 'list',
              items: landed.map((pullRequest) => ({
                text: [
                  {
                    link: pullRequest.title,
                    href: `https://example.com/${pullRequest.repository}/pull/${pullRequest.number}`,
                  },
                ],
                time: { at: pullRequest.at },
                meta: `${pullRequest.repository} #${pullRequest.number}`,
              })),
            },
          ],
        },
      ];

const factsSection: ReportBlock = {
  kind: 'section',
  heading: 'How the day went',
  blocks: [
    {
      kind: 'facts',
      items: [
        {
          term: 'Output',
          details: [['One change from start to finish, and a few small ones.']],
        },
        {
          term: 'Focus',
          details: [
            [
              'The long stretch held; the afternoon was ',
              { emphasis: 'scattered' },
              '.',
            ],
          ],
        },
        {
          term: 'Direction',
          details: [['Mostly the work planned in the morning.']],
        },
        {
          term: 'Efficiency',
          details: [
            [
              'Two runs went over the same ground; ',
              { code: 'bun test' },
              ' caught it.',
            ],
          ],
        },
      ],
    },
  ],
};

/** The sample report for a day of sample metrics, the same every time for the same day. */
export const sampleReportDocument = (metrics: DayMetrics): ReportDocument => {
  const span = spanOf(metrics);
  const landed = samplePullRequestsOf(span, metrics.landedPrs ?? 0);
  const timeline = sampleTimelineOf(span, metrics, landed);
  return {
    version: reportDocumentVersion,
    blocks: [
      {
        kind: 'callout',
        tone: 'note',
        text: ['Sample data for a preview. Nothing here was measured.'],
      },
      {
        kind: 'paragraph',
        text: [
          `A day in ${partTitles.length} parts: a slow start, a long stretch on one change, and a tidy end.`,
        ],
      },
      tilesOf(metrics, timeline),
      { kind: 'section', heading: 'The day in parts', blocks: [partsOf(span)] },
      timeline,
      factsSection,
      ...appointmentsSection(timeline),
      ...pullRequestsSection(landed),
      ...sentMailTable(metrics),
      ...sourcesSection(metrics),
    ],
  };
};
