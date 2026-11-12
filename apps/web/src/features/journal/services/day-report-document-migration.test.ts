import { expect, it } from 'bun:test';
import { migrateGeneratedThrough } from '@postlude/db/migrate';
import { Effect } from 'effect';
import { withTemporaryDatabase } from '../testing/temporary-database.ts';
import { migrateJournalDatabase } from './journal-migration.ts';

const databaseUpgradeTimeout = 30_000;
const withPages = '0014_day_report_document';
const metrics = JSON.stringify({ day: '2026-03-01' });
const document = JSON.stringify({ version: 1, blocks: [] });

// The pages /wrap stored before documents go. A converted day keeps its
// document, its text and its search, and a day that is still only a page
// stops the upgrade rather than losing its report.
it(
  'drops the stored pages, keeps every converted report, and stops at a report that is only a page',
  async () => {
    await withTemporaryDatabase(async (upgrade) => {
      await Effect.runPromise(migrateGeneratedThrough(upgrade, withPages));
      await upgrade.query(
        `insert into agent_area (
          entry_date, day_metrics, metrics_version, report_document, report_html,
          report_text, report_model, report_generated_at
        ) values (
          '2026-03-01', $1::jsonb, 2, $2::jsonb, '<main><p>A page.</p></main>',
          'Merged the parser refactor.', 'wrap-model', now()
        )`,
        [metrics, document],
      );
      await upgrade.query(
        `insert into agent_area (
          entry_date, day_metrics, metrics_version, report_html, report_text,
          report_model, report_generated_at
        ) values (
          '2026-03-02', $1::jsonb, 2, '<main><p>Only a page.</p></main>',
          'Only a page.', 'wrap-model', now()
        )`,
        [metrics],
      );
      await expect(
        Effect.runPromise(migrateJournalDatabase(upgrade)),
      ).rejects.toThrow();

      await upgrade.query(
        `delete from agent_area where entry_date = date '2026-03-02'`,
      );
      await Effect.runPromise(migrateJournalDatabase(upgrade));

      const converted = await upgrade.query<{
        readonly text: string;
        readonly document: unknown;
        readonly found: boolean;
      }>(`
        select
          report_text as text,
          report_document as document,
          report_search_vector @@ to_tsquery('simple', 'parser') as found
        from agent_area where entry_date = date '2026-03-01'
      `);
      expect(converted.rows).toEqual([
        {
          text: 'Merged the parser refactor.',
          document: { version: 1, blocks: [] },
          found: true,
        },
      ]);
      const leftovers = await upgrade.query<{
        readonly column: boolean;
        readonly reader: boolean;
      }>(`
        select
          exists (
            select from information_schema.columns
            where table_name = 'agent_area' and column_name = 'report_html'
          ) as column,
          exists (select from pg_proc where proname = 'report_plain_text') as reader
      `);
      expect(leftovers.rows).toEqual([{ column: false, reader: false }]);

      // A document without its text, or one that is not an object, is half a report.
      const halves = [
        `insert into agent_area (
          entry_date, day_metrics, metrics_version, report_document,
          report_model, report_generated_at
        ) values ('2026-03-03', '{}'::jsonb, 2, '{}'::jsonb, 'wrap-model', now())`,
        `insert into agent_area (entry_date, report_document)
          values ('2026-03-04', '{"version":1,"blocks":[]}'::jsonb)`,
        `insert into agent_area (
          entry_date, day_metrics, metrics_version, report_document, report_text,
          report_model, report_generated_at
        ) values ('2026-03-05', '{}'::jsonb, 2, '[]'::jsonb, '', 'wrap-model', now())`,
      ];
      await Promise.all(
        halves.map((half) => expect(upgrade.query(half)).rejects.toThrow()),
      );
    });
  },
  databaseUpgradeTimeout,
);
