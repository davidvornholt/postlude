/**
 * The day metrics /wrap measures and Postlude stores (Contract 4 in the
 * personal-systems plan).
 *
 * /wrap writes them through the CLI, so they arrive as untrusted input and are
 * held to this shape before they are stored. Postlude stores `metricsVersion`
 * as given: /wrap bumps it whenever a definition changes, even when the shape
 * stays, and a change of shape needs a change here.
 *
 * Any number may be null when the source behind it was unreachable, and
 * `coverage` says which source that was. Postlude never fills a gap in.
 * Minutes are whole minutes, as /wrap rounds them.
 */

import { Schema } from 'effect';

import { JournalDateSchema } from './entry.ts';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Measured = Schema.NullOr(Count);
const labelLengthLimit = 200;
const Label = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(labelLengthLimit),
);

/** An instant with its offset, as `Date.prototype.toISOString` or /wrap writes it. */
const isoInstantPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?<seconds>:\d{2}(?<fraction>\.\d{1,9})?)?(?<offset>Z|[+-]\d{2}:\d{2})$/u;
const IsoInstant = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      isoInstantPattern.test(value) && !Number.isNaN(Date.parse(value)),
    {
      identifier: 'IsoInstant',
      description: 'an ISO 8601 instant with a time zone offset',
    },
  ),
);

export const MetricsVersionSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1),
);

/** At most this many categories, mailboxes, or coverage rows per day. */
const listLimit = 100;
const limitedArray = <S extends Schema.Top>(item: S) =>
  Schema.Array(item).check(Schema.isMaxLength(listLimit));

export const DayMetricsSchema = Schema.Struct({
  metricsVersion: MetricsVersionSchema,
  day: JournalDateSchema,
  activeMinutes: Measured,
  firstActivityAt: Schema.NullOr(IsoInstant),
  lastActivityAt: Schema.NullOr(IsoInstant),
  focusMinutes: Measured,
  scatteredMinutes: Measured,
  /** Estimates, and labelled so in every view. */
  categories: limitedArray(
    Schema.Struct({ id: Label, label: Label, minutes: Measured }),
  ),
  offComputerMinutes: Measured,
  appointmentMinutes: Measured,
  appointmentOffScreenMinutes: Measured,
  landedPrs: Measured,
  sentMails: limitedArray(Schema.Struct({ mailbox: Label, count: Measured })),
  /** Which sources were read, and how completely, such as `complete`. */
  coverage: limitedArray(Schema.Struct({ source: Label, status: Label })),
});

export type DayMetrics = Schema.Schema.Type<typeof DayMetricsSchema>;
