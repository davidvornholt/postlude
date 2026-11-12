/**
 * The one-time conversion of the day reports /wrap stored as pages into report
 * documents, and its undo. `scripts/convert-day-reports.ts` runs it.
 *
 * Each day whose report is a page and not yet a document gets the document
 * the page converts to, and the document's words become the report's text,
 * which search reads. The page stays stored beside it, untouched, so the
 * conversion can be undone, and done again with a better reader. A page
 * without any words is left as it is.
 *
 * Both run in one transaction and answer with counts alone: no day, no words
 * of a report, and nothing from the database's errors, which can quote a row.
 */

import { Effect, Schema } from 'effect';
import { SqlClient } from 'effect/sql';

import { readReportDocument, reportPlainText } from '../day-report-reader.ts';
import {
  type ConvertedReport,
  convertLegacyReport,
  type LegacyShape,
} from './legacy-report.ts';

export class DayReportConversionError extends Schema.TaggedError<DayReportConversionError>()(
  'DayReportConversionError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

const failed = (message: string) => (cause: unknown) =>
  new DayReportConversionError({ message, cause });

const StoredPageRow = Schema.Struct({
  day: Schema.String,
  reportHtml: Schema.String,
  dayMetrics: Schema.Unknown,
}).pipe(
  Schema.encodeKeys({ reportHtml: 'report_html', dayMetrics: 'day_metrics' }),
);
const decodeStoredPages = Schema.decodeUnknownEffect(
  Schema.Array(StoredPageRow),
);
const CountRow = Schema.Struct({ count: Schema.Number });
const decodeCount = Schema.decodeUnknownEffect(Schema.Array(CountRow));

export type ConversionCounts = {
  /** Days whose report was a page and not yet a document. */
  readonly pages: number;
  /** Of those, the ones given a document, or that would be on a dry run. */
  readonly converted: number;
  /** The documents by the shape of the page they were read from. */
  readonly byShape: Readonly<Record<LegacyShape | 'text', number>>;
  /** Pages without any words, which keep no document. */
  readonly withoutWords: number;
  readonly dryRun: boolean;
};

const countsOf = (
  converted: ReadonlyArray<ConvertedReport | undefined>,
  dryRun: boolean,
): ConversionCounts => {
  const byShape: Record<LegacyShape | 'text', number> = {
    'wrap-47': 0,
    'wrap-45': 0,
    'wrap-43': 0,
    'wrap-17': 0,
    'postlude-sample': 0,
    text: 0,
  };
  for (const report of converted) {
    if (report !== undefined) {
      byShape[report.shape] += 1;
    }
  }
  const documents = converted.filter((report) => report !== undefined).length;
  return {
    pages: converted.length,
    converted: documents,
    byShape,
    withoutWords: converted.length - documents,
    dryRun,
  };
};

const convertWith = (sql: SqlClient.SqlClient, dryRun: boolean) =>
  Effect.gen(function* () {
    const pages = yield* sql`
      select entry_date::text as day, report_html, day_metrics
      from agent_area
      where report_html is not null and report_document is null
      order by entry_date
      for update
    `.pipe(
      Effect.flatMap(decodeStoredPages),
      Effect.mapError(failed('The stored report pages could not be read.')),
    );
    const converted = pages.map((page) =>
      convertLegacyReport({
        html: page.reportHtml,
        day: page.day,
        dayMetrics: page.dayMetrics,
      }),
    );
    if (!dryRun) {
      yield* Effect.forEach(
        pages,
        (page, at) => {
          const report = converted[at];
          if (report === undefined) {
            return Effect.void;
          }
          const text = reportPlainText(readReportDocument(report.document));
          return sql`
            update agent_area set
              report_document = ${JSON.stringify(report.document)}::jsonb,
              report_text = ${text}
            where entry_date = ${page.day}
              and report_html is not null
              and report_document is null
          `.pipe(
            Effect.asVoid,
            Effect.mapError(failed('A converted report could not be stored.')),
          );
        },
        { discard: true },
      );
    }
    return countsOf(converted, dryRun);
  });

/**
 * Gives every report stored as a page the document it converts to. On a dry
 * run the pages are read and converted, and nothing is written.
 */
export const convertStoredReports = ({
  dryRun,
}: {
  readonly dryRun: boolean;
}): Effect.Effect<
  ConversionCounts,
  DayReportConversionError,
  SqlClient.SqlClient
> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* convertWith(sql, dryRun).pipe(
      sql.withTransaction,
      Effect.catchTag(
        'SqlError',
        failed('The conversion could not finish, and changed nothing.'),
      ),
    );
  });

export type UndoCounts = {
  /** Days whose report went back to the page it was converted from. */
  readonly restored: number;
  readonly dryRun: boolean;
};

/**
 * Takes the converted documents away again, leaving each day's page as its
 * report and the page's words as its text, as before the conversion. Only a
 * day that has both was converted: /wrap stores a document without a page.
 */
export const undoConvertedReports = ({
  dryRun,
}: {
  readonly dryRun: boolean;
}): Effect.Effect<UndoCounts, DayReportConversionError, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = dryRun
      ? yield* sql`
          select count(*)::int as count
          from agent_area
          where report_html is not null and report_document is not null
        `
      : yield* sql`
          with restored as (
            update agent_area set
              report_document = null,
              report_text = report_plain_text(report_html)
            where report_html is not null and report_document is not null
            returning 1
          )
          select count(*)::int as count from restored
        `;
    const [counted] = yield* decodeCount(rows);
    return { restored: counted?.count ?? 0, dryRun };
  }).pipe(
    Effect.mapError(
      failed('The conversion could not be undone, and nothing changed.'),
    ),
  );
