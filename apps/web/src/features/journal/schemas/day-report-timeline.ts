/**
 * The timeline block of a day report document: the day drawn as rows of marks
 * along its hours, which Postlude lays out, labels, and explains on hover.
 *
 * /wrap's scripts build it from the data they collected, so every mark is a
 * value. Postlude derives everything else: the hours of the axis, where each
 * mark sits, the dividers at the start of each part, the legend, and the card
 * a mark shows. A mark carries only what its card may say: a sent mail's
 * subject and the titles of the user's own windows, but never a word of a
 * prompt or a conversation. The report's text and search leave them out.
 */

import { Schema } from 'effect';

import {
  CountSchema,
  endsAfterStart,
  InstantSchema,
  MinutesSchema,
  ReportHeadingSchema,
  ReportLabelSchema,
  ReportSummarySchema,
  timeRangeFields,
} from './day-report-text.ts';

const appsPerMark = 12;
const projectsPerMark = 8;
const threadsPerMark = 8;
const windowsPerMark = 3;
const pullRequestsPerRun = 40;
const marksPerRow = 2000;
const rowsPerGroup = 80;
/** The parts, the screen time, the events, and a group of threads for each area. */
const groupsPerTimeline = 24;
const notesPerTimeline = 8;

/** A number counted from one: a pull request's, or a part's in the day. */
const OrdinalSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/**
 * A landed pull request. Its number is missing only in reports converted from
 * pages that didn't keep it.
 */
const PullRequestSchema = Schema.Struct({
  repository: ReportLabelSchema,
  number: Schema.optionalKey(OrdinalSchema),
  title: ReportLabelSchema,
});

/** One part of the day, numbered as the day in parts numbers it. */
const PartMarkSchema = Schema.Struct({
  kind: Schema.Literal('part'),
  ...timeRangeFields,
  number: OrdinalSchema,
  title: Schema.optionalKey(ReportHeadingSchema),
}).check(endsAfterStart);

/**
 * Whether a stretch of screen time counted as focus, by the activity
 * summary's focus blocks. A focus block is a run in one area in which every
 * switch away, to another area, to no area, or away from the computer, is
 * shorter than two minutes, and whose time at the computer, the switches
 * included, is at least 25 minutes.
 *
 * counted is the focus block within the stretch, with its time at the
 * computer. short is a stretch whose time at the computer falls short of
 * what focus needs. noArea is time in no area, which never counts. notCounted
 * is a stretch long enough that didn't count, because its start counted
 * toward a focus block of the area named in within.
 */
const ScreenFocusSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('counted'),
    ...timeRangeFields,
    minutes: MinutesSchema,
  }).check(endsAfterStart),
  Schema.Struct({
    status: Schema.Literal('short'),
    minutes: MinutesSchema,
    needs: MinutesSchema,
  }),
  Schema.Struct({ status: Schema.Literal('noArea') }),
  Schema.Struct({
    status: Schema.Literal('notCounted'),
    within: Schema.optionalKey(ReportLabelSchema),
  }),
]);

export type ScreenFocus = Schema.Schema.Type<typeof ScreenFocusSchema>;

const labelsOf = (most: number) =>
  Schema.optionalKey(
    Schema.Array(ReportLabelSchema).check(Schema.isMaxLength(most)),
  );

/**
 * A stretch of screen time in the row's area, joined across switches shorter
 * than two minutes, the stretch the summary's focus rule tests. Its other
 * fields are missing in reports converted from pages that didn't keep them.
 */
const ScreenMarkSchema = Schema.Struct({
  kind: Schema.Literal('screen'),
  ...timeRangeFields,
  /** The row's screen time inside the stretch, without the gaps it joins. */
  minutes: MinutesSchema,
  /** The apps used, most used first, with their minutes in the stretch. */
  apps: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({ name: ReportLabelSchema, minutes: MinutesSchema }),
    ).check(Schema.isMaxLength(appsPerMark)),
  ),
  /** The T3 projects the stretch went to, most time first. */
  projects: labelsOf(projectsPerMark),
  /** The threads prompted in the stretch, the first prompted first. */
  threads: labelsOf(threadsPerMark),
  /** How many more threads were prompted than threads names. */
  moreThreads: Schema.optionalKey(CountSchema),
  /** The titles of the user's own windows in front longest. */
  windows: labelsOf(windowsPerMark),
  focus: Schema.optionalKey(ScreenFocusSchema),
}).check(endsAfterStart);

/** A focus block on the row's area. */
const FocusMarkSchema = Schema.Struct({
  kind: Schema.Literal('focus'),
  ...timeRangeFields,
  /**
   * Its time at the computer, the short switches included. Missing in
   * reports converted from pages that didn't keep it.
   */
  minutes: Schema.optionalKey(MinutesSchema),
}).check(endsAfterStart);

/** An agent running in the row's thread. */
const RunMarkSchema = Schema.Struct({
  kind: Schema.Literal('run'),
  ...timeRangeFields,
  /** What the thread landed that day, where T3 Code links the two. */
  pullRequests: Schema.optionalKey(
    Schema.Array(PullRequestSchema).check(
      Schema.isMaxLength(pullRequestsPerRun),
    ),
  ),
}).check(endsAfterStart);

/** A prompt in the row's thread. Its words are never stored. */
const PromptMarkSchema = Schema.Struct({
  kind: Schema.Literal('prompt'),
  at: InstantSchema,
  fromPhone: Schema.optionalKey(Schema.Boolean),
});

const AppointmentMarkSchema = Schema.Struct({
  kind: Schema.Literal('appointment'),
  ...timeRangeFields,
  title: ReportLabelSchema,
}).check(endsAfterStart);

const PullRequestMarkSchema = Schema.Struct({
  kind: Schema.Literal('pullRequest'),
  at: InstantSchema,
  ...PullRequestSchema.fields,
  /** The first sentences of its description: what it changed. */
  summary: Schema.optionalKey(ReportSummarySchema),
});

/**
 * A sent mail: its time, mailbox and subject, and nothing of what it said.
 * The mailbox and subject are missing in reports converted from pages that
 * didn't name them, and the subject also when the mail had none.
 */
const MailMarkSchema = Schema.Struct({
  kind: Schema.Literal('mail'),
  at: InstantSchema,
  mailbox: Schema.optionalKey(ReportLabelSchema),
  subject: Schema.optionalKey(ReportLabelSchema),
});

export const TimelineMarkSchema = Schema.Union([
  PartMarkSchema,
  ScreenMarkSchema,
  FocusMarkSchema,
  RunMarkSchema,
  PromptMarkSchema,
  AppointmentMarkSchema,
  PullRequestMarkSchema,
  MailMarkSchema,
]);

export type TimelineMark = Schema.Schema.Type<typeof TimelineMarkSchema>;
export type TimelineMarkKind = TimelineMark['kind'];

const TimelineRowSchema = Schema.Struct({
  label: ReportLabelSchema,
  /** A few words more about the row, such as a thread's project. */
  note: Schema.optionalKey(ReportLabelSchema),
  /** The row's total, shown beside its label, such as an area's screen time. */
  total: Schema.optionalKey(Schema.Struct({ minutes: MinutesSchema })),
  marks: Schema.Array(TimelineMarkSchema).check(
    Schema.isMaxLength(marksPerRow),
  ),
});

export type TimelineRow = Schema.Schema.Type<typeof TimelineRowSchema>;

const TimelineGroupSchema = Schema.Struct({
  title: ReportLabelSchema,
  rows: Schema.Array(TimelineRowSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(rowsPerGroup),
  ),
});

export type TimelineGroup = Schema.Schema.Type<typeof TimelineGroupSchema>;

export const TimelineBlockSchema = Schema.Struct({
  kind: Schema.Literal('timeline'),
  heading: ReportHeadingSchema,
  groups: Schema.Array(TimelineGroupSchema).check(
    Schema.isMaxLength(groupsPerTimeline),
  ),
  /** What the timeline may be missing, such as a source that wasn't read. */
  notes: Schema.optionalKey(
    Schema.Array(ReportLabelSchema).check(Schema.isMaxLength(notesPerTimeline)),
  ),
});

export type TimelineBlock = Schema.Schema.Type<typeof TimelineBlockSchema>;
