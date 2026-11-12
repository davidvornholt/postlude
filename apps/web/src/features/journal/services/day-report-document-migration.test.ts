import { expect, it } from 'bun:test';
import { migrateGeneratedThrough } from '@postlude/db/migrate';
import { Effect } from 'effect';
import { withTemporaryDatabase } from '../testing/temporary-database.ts';
import { migrateJournalDatabase } from './journal-migration.ts';

const databaseUpgradeTimeout = 30_000;
const beforeDocuments = '0013_day_report_search';
const metrics = JSON.stringify({ day: '2026-03-01' });

// A report stored as a page before documents keeps the text and the search
// it had, and a document stored after them brings its own text.
it(
  'keeps the text of a report stored as a page, and takes a document with its text',
  async () => {
    await withTemporaryDatabase(async (upgrade) => {
      await Effect.runPromise(
        migrateGeneratedThrough(upgrade, beforeDocuments),
      );
      await upgrade.query(
        `insert into agent_area (
          entry_date, day_metrics, metrics_version, report_html, report_model,
          report_generated_at
        ) values ('2026-03-01', $1::jsonb, 2, $2, 'wrap-model', now())`,
        [metrics, '<main><p>Merged the parser refactor.</p></main>'],
      );
      await Effect.runPromise(migrateJournalDatabase(upgrade));

      const page = await upgrade.query<{
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
      expect(page.rows[0]).toEqual({
        text: 'Merged the parser refactor.',
        document: null,
        found: true,
      });

      await upgrade.query(
        `insert into agent_area (
          entry_date, day_metrics, metrics_version, report_document, report_text,
          report_model, report_generated_at
        ) values ('2026-03-02', $1::jsonb, 2, $2::jsonb, $3, 'wrap-model', now())`,
        [
          metrics,
          JSON.stringify({ version: 1, blocks: [] }),
          'Wrote the converter.',
        ],
      );
      const search = await upgrade.query<{ readonly day: string }>(`
        select to_char(entry_date, 'YYYY-MM-DD') as day from agent_area
        where report_search_vector @@ to_tsquery('simple', 'converter')
      `);
      expect(search.rows).toEqual([{ day: '2026-03-02' }]);

      // A document without its text, or a page and nothing else, is half a report.
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
