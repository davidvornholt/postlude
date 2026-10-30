/**
 * One day of a date range as `postlude days list` returns it: the ratings, the
 * word counts, and the day metrics, without any prose. /wrap draws its trend
 * lines from these, and the agent note reads the days before the one it is
 * written for.
 */

import { Schema, SchemaGetter } from 'effect';

import { DayMetricsSchema, MetricsVersionSchema } from './day-metrics.ts';
import { EnergySchema, ProgressSchema, RepeatDaySchema } from './day-rating.ts';
import { JournalDateSchema, WordCountSchema } from './entry.ts';

/** The longest range one call returns: a leap year. */
export const dayRangeLimit = 366;

const DayOverviewRow = Schema.Struct({
  date: JournalDateSchema,
  journalWordCount: Schema.NullOr(WordCountSchema),
  scriptureWordCount: Schema.NullOr(WordCountSchema),
  energy: Schema.NullOr(EnergySchema),
  progress: Schema.NullOr(ProgressSchema),
  repeatDay: Schema.NullOr(RepeatDaySchema),
  ratingVersion: Schema.NullOr(Schema.Int),
  closedAt: Schema.NullOr(Schema.Date),
  dayMetrics: Schema.NullOr(DayMetricsSchema),
  metricsVersion: Schema.NullOr(MetricsVersionSchema),
}).pipe(
  Schema.encodeKeys({
    date: 'entry_date',
    journalWordCount: 'journal_word_count',
    scriptureWordCount: 'scripture_word_count',
    repeatDay: 'repeat_day',
    ratingVersion: 'rating_version',
    closedAt: 'closed_at',
    dayMetrics: 'day_metrics',
    metricsVersion: 'metrics_version',
  }),
);

export type DayOverview = {
  readonly date: string;
  /** Zero for a day with no entry. */
  readonly journalWordCount: number;
  readonly scriptureWordCount: number;
  readonly rating: {
    readonly energy: Schema.Schema.Type<typeof EnergySchema> | null;
    readonly progress: Schema.Schema.Type<typeof ProgressSchema> | null;
    readonly repeatDay: Schema.Schema.Type<typeof RepeatDaySchema> | null;
    readonly ratingVersion: number | null;
  };
  readonly closedAt: Date | null;
  readonly dayMetrics: Schema.Schema.Type<typeof DayMetricsSchema> | null;
  readonly metricsVersion: number | null;
};

const DayOverviewSchema: Schema.Codec<DayOverview> = Schema.Struct({
  date: Schema.String,
  journalWordCount: Schema.Number,
  scriptureWordCount: Schema.Number,
  rating: Schema.Struct({
    energy: Schema.NullOr(EnergySchema),
    progress: Schema.NullOr(ProgressSchema),
    repeatDay: Schema.NullOr(RepeatDaySchema),
    ratingVersion: Schema.NullOr(Schema.Number),
  }),
  closedAt: Schema.NullOr(Schema.Date),
  dayMetrics: Schema.NullOr(DayMetricsSchema),
  metricsVersion: Schema.NullOr(Schema.Number),
});

/** Decode-only: nothing writes a day back through this shape. */
export const DayOverviewFromRow = DayOverviewRow.pipe(
  Schema.decodeTo(DayOverviewSchema, {
    decode: SchemaGetter.transform(
      (row): DayOverview => ({
        date: row.date,
        journalWordCount: row.journalWordCount ?? 0,
        scriptureWordCount: row.scriptureWordCount ?? 0,
        rating: {
          energy: row.energy,
          progress: row.progress,
          repeatDay: row.repeatDay,
          ratingVersion: row.ratingVersion,
        },
        closedAt: row.closedAt,
        dayMetrics: row.dayMetrics,
        metricsVersion: row.metricsVersion,
      }),
    ),
    encode: SchemaGetter.forbiddenEncoding,
  }),
);

export const DayRangeSchema = Schema.Struct({
  from: JournalDateSchema,
  to: JournalDateSchema,
});
