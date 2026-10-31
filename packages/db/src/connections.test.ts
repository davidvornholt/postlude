import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import { SqlClient } from 'effect/sql';
import {
  createPool,
  pgClientLayer,
  pgPoolSize,
  sqlClientPoolSize,
} from './connections.ts';
import { databaseUrl } from './test-database-url.ts';

/**
 * The `CONNECTION LIMIT` of the app's role in a pull request preview's
 * database (personal-infra, `infra/modules/apps/postlude-previews.nix`).
 */
const previewRoleConnectionLimit = 4;

const sleep = 'select pg_sleep(0.2)';

it('keeps both pools within the preview role connection limit under full load', async () => {
  const configured = databaseUrl();
  const admin = createPool(configured);
  const role = `postlude_limit_${crypto.randomUUID().replaceAll('-', '')}`;
  const password = crypto.randomUUID();
  await admin.query(
    `create role "${role}" login password '${password}' connection limit ${previewRoleConnectionLimit}`,
  );
  const url = new URL(configured);
  url.username = role;
  url.password = password;
  const pool = createPool(url.href);
  try {
    // One query more than each pool holds, so both pools open every
    // connection they may and the extra query waits for one.
    const [pgResults, sqlClientResults] = await Promise.all([
      Promise.all(
        Array.from({ length: pgPoolSize + 1 }, () => pool.query(sleep)),
      ),
      Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          return yield* Effect.all(
            Array.from({ length: sqlClientPoolSize + 1 }, () =>
              sql.unsafe(sleep),
            ),
            { concurrency: 'unbounded' },
          );
        }).pipe(Effect.provide(pgClientLayer(url.href))),
      ),
    ]);
    expect(pgResults).toHaveLength(pgPoolSize + 1);
    expect(sqlClientResults).toHaveLength(sqlClientPoolSize + 1);
  } finally {
    await pool.end();
    await admin.query(`drop role "${role}"`);
    await admin.end();
  }
});
