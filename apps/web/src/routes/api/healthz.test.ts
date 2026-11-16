import { describe, expect, it } from 'bun:test';
// biome-ignore lint/correctness/noNodejsModules: This test runs only under Bun and passes the process environment on to a child process.
import process from 'node:process';
import { createPool } from '@postlude/db/connections';
import { fileURLToPath, spawn } from 'bun';
import { Effect } from 'effect';

import { configuredDatabaseUrl } from '#/shared/testing/test-database.ts';

/**
 * Runs in a process of its own, because the app's configuration and database
 * client are created when their modules load. The script plays through a
 * database outage the way a PostgreSQL restart shows it: new connections fail
 * and the app's existing ones end. Then the database comes back, and the same
 * process, with no restart, answers again.
 */
const probe = `
import { createPool } from '@postlude/db/connections';
import { Effect } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';
import { Route } from '#/routes/api/healthz.ts';
import { closeDatabase, sqlClientLayer } from '#/shared/db/database.ts';

// The app's connections carry this name, so only they end.
const appName = 'healthz-probe';
const adminUrl = new URL(process.env.DATABASE_URL);
const database = adminUrl.pathname.slice(1);
// PostgreSQL does not allow ALLOW_CONNECTIONS for the connected database.
adminUrl.pathname = '/postgres';
adminUrl.searchParams.delete('application_name');
const admin = createPool(adminUrl.href);

const health = async () => {
  const startedAt = performance.now();
  const response = await Route.options.server.handlers.GET({});
  return {
    status: response.status,
    body: await response.text(),
    elapsedMs: Math.round(performance.now() - startedAt),
  };
};
const readable = async () =>
  (
    await Effect.runPromise(
      Effect.exit(Effect.flatMap(SqlClient, (sql) => sql\`select 1\`)).pipe(
        Effect.provide(sqlClientLayer),
      ),
    )
  )._tag === 'Success';

const allowConnections = (allowed) =>
  admin.query('alter database "' + database + '" allow_connections ' + allowed);

const result = {};
try {
  result.before = await health();
  await allowConnections(false);
  await admin.query(
    'select pg_terminate_backend(pid) from pg_stat_activity where application_name = $1',
    [appName],
  );
  result.readableDuringOutage = await readable();
  result.during = await health();
  await allowConnections(true);
  result.after = await health();
  result.readableAfterOutage = await readable();
} finally {
  await allowConnections(true);
  await closeDatabase();
  await admin.end();
}
console.log('RESULT ' + JSON.stringify(result));
`;

const okStatus = 200;
const unavailableStatus = 503;
const outageDeadlineMs = 3000;
const resultPrefix = 'RESULT ';
const appDirectory = fileURLToPath(new URL('../../../', import.meta.url));

describe('health route with a real database', () => {
  it('reports unavailable while the database cannot answer and recovers without a restart', async () => {
    const configured = new URL(
      await Effect.runPromise(configuredDatabaseUrl()),
    );
    const name = `healthz_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = createPool(configured.href);
    await admin.query(`create database "${name}"`);
    try {
      const databaseUrl = new URL(configured);
      databaseUrl.pathname = `/${name}`;
      databaseUrl.searchParams.set('application_name', 'healthz-probe');
      const { ANTHROPIC_API_KEY: _omitted, ...inherited } = process.env;
      const child = spawn(['bun', '-e', probe], {
        cwd: appDirectory,
        env: {
          ...inherited,
          DATABASE_URL: databaseUrl.href,
          BETTER_AUTH_SECRET: 'x'.repeat(32),
          BETTER_AUTH_URL: 'http://localhost:9999',
          GITHUB_CLIENT_ID: 'test',
          GITHUB_CLIENT_SECRET: 'test',
          GITHUB_ALLOWED_ACCOUNT_ID: '1',
          JOURNAL_TIME_ZONE: 'Europe/Berlin',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
      const line = stdout
        .split('\n')
        .find((entry) => entry.startsWith(resultPrefix));
      const result = JSON.parse(line?.slice(resultPrefix.length) ?? 'null');

      expect(result.before).toMatchObject({ status: okStatus });
      expect(JSON.parse(result.before.body)).toEqual({ status: 'ok' });
      expect(result.readableDuringOutage).toBe(false);
      expect(result.during).toMatchObject({
        status: unavailableStatus,
        body: '',
      });
      expect(result.during.elapsedMs).toBeLessThan(outageDeadlineMs);
      expect(result.after).toMatchObject({ status: okStatus });
      expect(result.readableAfterOutage).toBe(true);
    } finally {
      await admin.query(`drop database if exists "${name}" with (force)`);
      await admin.end();
    }
  }, 60_000);
});
