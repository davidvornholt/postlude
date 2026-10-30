/**
 * What the `postlude_agent` role can do: exactly what the CLI needs and no
 * more. It reads the journal, the ratings, and the /wrap columns, and writes
 * only the /wrap columns. Every test switches to the role inside its own
 * rolled-back transaction, the way the CLI connects on prod-1.
 */

import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { SqlClient } from 'effect/sql';

import { runCliCommand } from '../cli/cli-program.ts';
import type { WrapPut } from '../schemas/agent-area.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import { refusalOf } from '../testing/sql-refusal.ts';

const { withEvening } = journalDatabase();

const day = '2026-10-30';
const insufficientPrivilege = '42501';

const asAgent = (sql: SqlClient.SqlClient) =>
  sql`set local role postlude_agent`;

const wrap: WrapPut = {
  dayMetrics: {
    metricsVersion: 1,
    day,
    activeMinutes: 300,
    firstActivityAt: null,
    lastActivityAt: null,
    focusMinutes: null,
    scatteredMinutes: null,
    categories: [],
    offComputerMinutes: null,
    appointmentMinutes: null,
    appointmentOffScreenMinutes: null,
    landedPrs: 0,
    sentMails: [],
    coverage: [{ source: 'activitywatch', status: 'complete' }],
  },
  metricsVersion: 1,
  reportHtml: '<p>The day.</p>',
  reportModel: 'wrap-model',
};

const noStdin = Effect.die('This command reads no stdin.');

it('holds exactly the grants the contract gives it', async () => {
  const grants = await withEvening(({ sql }) =>
    Effect.gen(function* () {
      const tables = yield* sql<{
        readonly table: string;
        readonly privilege: string;
      }>`
        select table_name as table, privilege_type as privilege
        from information_schema.role_table_grants
        where grantee = 'postlude_agent'
        order by 1, 2
      `;
      const columns = yield* sql<{
        readonly column: string;
        readonly privilege: string;
      }>`
        select column_name as column, privilege_type as privilege
        from information_schema.column_privileges
        where grantee = 'postlude_agent' and table_name = 'agent_area'
        order by 2, 1
      `;
      return { tables, columns };
    }),
  );
  expect(grants.tables).toEqual([
    { table: 'day_rating', privilege: 'SELECT' },
    { table: 'entry', privilege: 'SELECT' },
    { table: 'entry_search_evidence', privilege: 'SELECT' },
  ]);
  const wrapColumns = [
    'day_metrics',
    'metrics_version',
    'report_generated_at',
    'report_html',
    'report_model',
  ];
  const keyAndWrapColumns = ['entry_date', ...wrapColumns].sort();
  expect(grants.columns).toEqual([
    ...keyAndWrapColumns.map((column) => ({ column, privilege: 'INSERT' })),
    ...keyAndWrapColumns.map((column) => ({ column, privilege: 'SELECT' })),
    ...wrapColumns.map((column) => ({ column, privilege: 'UPDATE' })),
  ]);
});

it('runs every CLI command', async () => {
  const outcome = await withEvening(({ sql, entries, ratings }) =>
    Effect.gen(function* () {
      yield* entries.save(draft(day, 'Grace at the end of a long day.'));
      yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
      yield* asAgent(sql);
      const stdin = Effect.succeed(JSON.stringify(wrap));
      return {
        day: yield* runCliCommand({ kind: 'day-get', date: day }, noStdin),
        days: yield* runCliCommand(
          { kind: 'days-list', from: '2026-10-29', to: day },
          noStdin,
        ),
        search: yield* runCliCommand(
          { kind: 'search', query: 'grace', limit: 5 },
          noStdin,
        ),
        put: yield* runCliCommand({ kind: 'agent-area-put', date: day }, stdin),
        putAgain: yield* runCliCommand(
          { kind: 'agent-area-put', date: day },
          stdin,
        ),
        get: yield* runCliCommand(
          { kind: 'agent-area-get', date: day },
          noStdin,
        ),
      };
    }),
  );
  expect(outcome.day).toMatchObject({
    date: day,
    revision: 1,
    journalMarkdown: 'Grace at the end of a long day.',
    rating: { energy: 'okay', progress: 'solid', ratingVersion: 1 },
    closedAt: null,
  });
  expect(Object.keys(outcome.day as object)).not.toContain('agentNote');
  expect(outcome.days).toMatchObject({
    days: [{ date: '2026-10-29' }, { date: day, journalWordCount: 8 }],
  });
  expect(outcome.search).toMatchObject({
    hits: [{ date: day, sources: [{ source: 'evening' }] }],
  });
  expect(outcome.put).toMatchObject({ date: day, reportHtmlBytes: 15 });
  expect(outcome.get).toMatchObject({
    date: day,
    reportHtml: '<p>The day.</p>',
    reportModel: 'wrap-model',
  });
});

it('cannot change the journal or the ratings', async () => {
  const refusals = await withEvening(({ sql, entries, ratings }) =>
    Effect.gen(function* () {
      yield* entries.save(draft(day, 'Words.'));
      yield* ratings.save({ date: day, energy: 'okay' });
      yield* asAgent(sql);
      return yield* Effect.all([
        refusalOf(
          sql,
          sql`update entry set journal_markdown = 'Changed.' where entry_date = ${day}`,
        ),
        refusalOf(sql, sql`delete from entry where entry_date = ${day}`),
        refusalOf(
          sql,
          sql`insert into entry (entry_date) values ('2026-10-31')`,
        ),
        refusalOf(sql, sql`delete from entry_search_evidence`),
        refusalOf(
          sql,
          sql`update day_rating set energy = 'fresh' where entry_date = ${day}`,
        ),
        refusalOf(
          sql,
          sql`insert into day_rating (entry_date, rating_version) values ('2026-10-31', 1)`,
        ),
      ]);
    }),
  );
  for (const refusal of refusals) {
    expect(refusal.code).toBe(insufficientPrivilege);
  }
});

it('cannot read or write the agent note', async () => {
  const refusals = await withEvening(({ sql, areas }) =>
    Effect.gen(function* () {
      yield* areas.putWrap(day, wrap);
      yield* asAgent(sql);
      return yield* Effect.all([
        refusalOf(sql, sql`select agent_note from agent_area`),
        refusalOf(sql, sql`select * from agent_area`),
        refusalOf(
          sql,
          sql`update agent_area set agent_note = 'Forged.', agent_note_status = 'ready' where entry_date = ${day}`,
        ),
        refusalOf(
          sql,
          sql`update agent_area set agent_note_status = 'pending', agent_note_requested_at = now() where entry_date = ${day}`,
        ),
        refusalOf(
          sql,
          sql`insert into agent_area (entry_date, agent_note_status, agent_note_requested_at) values ('2026-10-31', 'pending', now())`,
        ),
        refusalOf(sql, sql`delete from agent_area where entry_date = ${day}`),
      ]);
    }),
  );
  for (const refusal of refusals) {
    expect(refusal.code).toBe(insufficientPrivilege);
  }
});

it('cannot read sign-in data or migrations', async () => {
  const refusals = await withEvening(({ sql }) =>
    Effect.gen(function* () {
      yield* asAgent(sql);
      return yield* Effect.all([
        refusalOf(sql, sql`select * from "user"`),
        refusalOf(sql, sql`select * from session`),
        refusalOf(sql, sql`select * from account`),
        refusalOf(sql, sql`select * from verification`),
        refusalOf(sql, sql`select * from drizzle.__drizzle_migrations`),
      ]);
    }),
  );
  for (const refusal of refusals) {
    expect(refusal.code).toBe(insufficientPrivilege);
  }
});
