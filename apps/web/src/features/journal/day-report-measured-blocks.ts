/**
 * Report blocks built from a day's metrics alone: the mail sent from each
 * mailbox, and which sources were read. The sample report composes them, and
 * so does the conversion of reports stored as pages, whose pages filled the
 * same figures in from the metrics.
 */

import type { DayMetrics } from './schemas/day-metrics.ts';
import type { ReportBlock } from './schemas/day-report-blocks.ts';

const unmeasured = 'Not measured';

/** The mail sent from each mailbox, as a table, if any mailbox was read. */
export const sentMailTable = (
  metrics: DayMetrics,
): ReadonlyArray<ReportBlock> =>
  metrics.sentMails.length === 0
    ? []
    : [
        {
          kind: 'table',
          caption: 'Sent mail by mailbox',
          columns: ['Mailbox', 'Sent'],
          rows: metrics.sentMails.map(({ mailbox, count }) => [
            [mailbox],
            [count === null ? unmeasured : String(count)],
          ]),
        },
      ];

/**
 * Which sources were read and how completely, folded away. `notes` follow
 * the list inside the section, such as a source that couldn't be reached.
 */
export const sourcesSection = (
  metrics: DayMetrics,
  notes: ReadonlyArray<ReportBlock> = [],
): ReadonlyArray<ReportBlock> => {
  const blocks: ReadonlyArray<ReportBlock> = [
    ...(metrics.coverage.length === 0
      ? []
      : [
          {
            kind: 'list' as const,
            items: metrics.coverage.map(({ source, status }) => ({
              text: [source],
              meta: status,
            })),
          },
        ]),
    ...notes,
  ];
  return blocks.length === 0
    ? []
    : [{ kind: 'section', heading: 'Sources', collapsed: true, blocks }];
};
