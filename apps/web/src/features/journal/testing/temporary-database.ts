/**
 * A database of its own for a test that migrates step by step. An upgrade
 * can't roll back across migration commits, so it gets a disposable database
 * and removes it, and the shared test database stays clean.
 */

import { createPool } from '@postlude/db/connections';
import { Effect } from 'effect';
import { configuredDatabaseUrl } from '#/shared/testing/test-database.ts';

export type MigrationPool = ReturnType<typeof createPool>;

export const withTemporaryDatabase = async (
  body: (pool: MigrationPool) => Promise<void>,
): Promise<void> => {
  const configured = await Effect.runPromise(configuredDatabaseUrl());
  const databaseName = `postlude_search_migration_${crypto.randomUUID().replaceAll('-', '')}`;
  const databaseUrl = new URL(configured);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = createPool(configured);
  const migrationPool = createPool(databaseUrl.toString());
  await admin.query(`create database "${databaseName}"`);
  try {
    await body(migrationPool);
  } finally {
    await migrationPool.end();
    await admin.query(`drop database "${databaseName}" with (force)`);
    await admin.end();
  }
};
