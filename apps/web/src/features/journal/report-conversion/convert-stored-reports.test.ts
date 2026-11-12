import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { SqlClient } from 'effect/sql';

import type { ReportDocument } from '../schemas/day-report-blocks.ts';
import { journalDatabase } from '../testing/database-harness.ts';
import {
  convertStoredReports,
  undoConvertedReports,
} from './convert-stored-reports.ts';
import { legacyFixture } from './fixtures/legacy-fixtures.ts';
import { convertLegacyReport } from './legacy-report.ts';

const { withEvening } = journalDatabase();

const fixture = legacyFixture('wrap-47');
const metrics = JSON.stringify(fixture.dayMetrics);
const unknownPage =
  '<!doctype html><main><p>Words of an older page.</p></main>';
const wordlessPage = '<!doctype html><main><div class="chart"></div></main>';
const storedDocument: ReportDocument = {
  version: 1,
  blocks: [{ kind: 'paragraph', text: ['Already a document.'] }],
};

const storePage = (sql: SqlClient.SqlClient, day: string, page: string) =>
  sql`
    insert into agent_area (
      entry_date, day_metrics, metrics_version, report_html, report_text,
      report_model, report_generated_at
    )
    values (
      ${day}, ${metrics}::jsonb, 1, ${page}, report_plain_text(${page}),
      'page-model', now()
    )
  `;

const storeDays = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    yield* storePage(sql, fixture.day, fixture.reportHtml);
    yield* storePage(sql, '2026-10-28', unknownPage);
    yield* storePage(sql, '2026-10-27', wordlessPage);
    yield* sql`
      insert into agent_area (
        entry_date, day_metrics, metrics_version, report_document, report_text,
        report_model, report_generated_at
      )
      values (
        '2026-10-26', ${metrics}::jsonb, 1,
        ${JSON.stringify(storedDocument)}::jsonb, 'Already a document.',
        'document-model', now()
      )
    `;
  });

const byShape = (wrap47: number, text: number) => ({
  'wrap-47': wrap47,
  'wrap-45': 0,
  'wrap-43': 0,
  'wrap-17': 0,
  'postlude-sample': 0,
  text,
});

it('converts every report stored as a page, keeps the page, and can be undone', async () => {
  const outcome = await withEvening(({ areas, sql }) =>
    Effect.gen(function* () {
      yield* storeDays(sql);
      const dryRun = yield* convertStoredReports({ dryRun: true });
      const afterDryRun = yield* areas.readWrap(fixture.day);
      const run = yield* convertStoredReports({ dryRun: false });
      const converted = {
        page: yield* areas.readWrap(fixture.day),
        text: yield* areas.readReportText(fixture.day),
        unknown: yield* areas.readWrap('2026-10-28'),
        wordless: yield* areas.readWrap('2026-10-27'),
        document: yield* areas.readWrap('2026-10-26'),
      };
      const again = yield* convertStoredReports({ dryRun: false });
      const undoDryRun = yield* undoConvertedReports({ dryRun: true });
      const undo = yield* undoConvertedReports({ dryRun: false });
      const [pageText] = yield* sql<{
        readonly text: string;
      }>`select report_plain_text(${fixture.reportHtml}) as text`;
      const undone = {
        page: yield* areas.readWrap(fixture.day),
        text: yield* areas.readReportText(fixture.day),
        document: yield* areas.readWrap('2026-10-26'),
      };
      return {
        dryRun,
        afterDryRun,
        run,
        converted,
        again,
        undoDryRun,
        undo,
        undone,
        pageText: pageText?.text,
      };
    }),
  );

  expect(outcome.dryRun).toEqual({
    pages: 3,
    converted: 2,
    byShape: byShape(1, 1),
    withoutWords: 1,
    dryRun: true,
  });
  expect(outcome.afterDryRun.reportDocument).toBeNull();

  expect(outcome.run).toEqual({ ...outcome.dryRun, dryRun: false });
  expect(outcome.converted.page.reportHtml).toBe(fixture.reportHtml);
  expect(outcome.converted.page.reportDocument).toEqual(
    convertLegacyReport({
      html: fixture.reportHtml,
      day: fixture.day,
      dayMetrics: fixture.dayMetrics,
    })?.document ?? null,
  );
  expect(outcome.converted.text).toContain('Agent time');
  expect(outcome.converted.unknown.reportDocument).toEqual(
    convertLegacyReport({
      html: unknownPage,
      day: '2026-10-28',
      dayMetrics: fixture.dayMetrics,
    })?.document ?? null,
  );
  expect(outcome.converted.wordless.reportDocument).toBeNull();
  expect(outcome.converted.wordless.reportHtml).toBe(wordlessPage);
  expect(outcome.converted.document.reportDocument).toEqual(storedDocument);

  expect(outcome.again).toEqual({
    pages: 1,
    converted: 0,
    byShape: byShape(0, 0),
    withoutWords: 1,
    dryRun: false,
  });

  expect(outcome.undoDryRun).toEqual({ restored: 2, dryRun: true });
  expect(outcome.undo).toEqual({ restored: 2, dryRun: false });
  expect(outcome.undone.page.reportDocument).toBeNull();
  expect(outcome.undone.page.reportHtml).toBe(fixture.reportHtml);
  expect(outcome.undone.text).toBe(outcome.pageText ?? '');
  expect(outcome.undone.document.reportDocument).toEqual(storedDocument);
});
