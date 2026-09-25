import { createPool } from '@postlude/db/pool';
import { Effect } from 'effect';
import { migrateJournalDatabase } from '../src/features/journal/services/journal-migration';
import { configuredDatabaseUrl } from '../src/shared/testing/test-database';

/** Browser fixtures have their own migrated database, separate from unit tests and the configured journal. */
export const prepareBrowserDatabase = async (): Promise<string> => {
  const configured = await Effect.runPromise(configuredDatabaseUrl());
  const url = new URL(configured);
  // Playwright reloads its config in each worker, inheriting the prepared URL.
  if (url.pathname.endsWith('_a11y')) {
    return configured;
  }
  const databaseName = `${url.pathname.slice(1)}_a11y`;
  const admin = createPool(configured);
  try {
    await admin.query(
      `create database "${databaseName.replaceAll('"', '""')}"`,
    );
  } catch (error) {
    if ((error as { code?: string }).code !== '42P04') {
      throw error;
    }
  } finally {
    await admin.end();
  }
  url.pathname = `/${databaseName}`;
  const pool = createPool(url.toString());
  try {
    await Effect.runPromise(migrateJournalDatabase(pool));
  } finally {
    await pool.end();
  }
  return url.toString();
};
