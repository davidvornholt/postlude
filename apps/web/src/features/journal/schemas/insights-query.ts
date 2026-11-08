import { Option, Schema } from 'effect';

import { firstYear, lastYear } from '../insights-range.ts';
import { JournalMonthSchema } from './calendar-query.ts';
import { JournalDateSchema } from './entry.ts';

const YearSchema = Schema.Int.check(
  Schema.isBetween({ minimum: firstYear, maximum: lastYear }),
);

/**
 * What Insights can be asked for. A plain `/insights` is this year, the view
 * the writer lands on, so it carries nothing in the address. A year can be
 * named; a week (by any of its days), a month, or all time say which they are.
 * The route and the server function both decode with this schema.
 */
export const InsightsQuery = Schema.Union([
  Schema.Struct({
    range: Schema.Literal('week'),
    week: Schema.optional(JournalDateSchema),
  }),
  Schema.Struct({
    range: Schema.Literal('month'),
    month: Schema.optional(JournalMonthSchema),
  }),
  Schema.Struct({ range: Schema.Literal('all') }),
  Schema.Struct({ year: Schema.optional(YearSchema) }),
]);

export type InsightsQueryParams = Schema.Schema.Type<typeof InsightsQuery>;

const decodeExactly = Schema.decodeUnknownSync(InsightsQuery);

/**
 * The server's decoding refuses keys it does not know, so a week that is not a
 * date cannot slip through as an address that only names this year.
 */
export const decodeInsightsQuery = (input: unknown): InsightsQueryParams =>
  decodeExactly(input, { onExcessProperty: 'error' });

const decodeLeniently = Schema.decodeUnknownOption(InsightsQuery);

/**
 * The address's reading of the same schema. A search that does not decode is
 * a view that does not exist, so it reads as this year rather than as an
 * error page; the server still decodes exactly what it is sent.
 */
export const insightsSearchOf = (search: unknown): InsightsQueryParams =>
  Option.getOrElse(decodeLeniently(search), (): InsightsQueryParams => ({}));
