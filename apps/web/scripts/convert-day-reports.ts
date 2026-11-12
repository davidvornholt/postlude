/**
 * `convert:day-reports`: the one-time conversion of the day reports /wrap
 * stored as pages into the report documents Postlude now draws.
 *
 *   bun run convert:day-reports --dry-run   counts what it would convert
 *   bun run convert:day-reports             converts, in one transaction
 *   bun run convert:day-reports --undo      takes the documents away again
 *
 * `--undo --dry-run` counts what an undo would restore. Each run prints its
 * counts as one line of JSON and nothing else: no day, no words of a report.
 * The pages stay stored, so an undo puts every converted day back as it was.
 */

import process from 'node:process';
import { pgClientLayer } from '@postlude/db/connections';
import { Cause, Effect, Exit } from 'effect';
import type { SqlClient } from 'effect/sql';

import {
  convertStoredReports,
  type DayReportConversionError,
  undoConvertedReports,
} from '../src/features/journal/report-conversion/convert-stored-reports.ts';

const knownFlags = new Set(['--dry-run', '--undo']);
const flags = Bun.argv.slice(2);
const unknown = flags.filter((flag) => !knownFlags.has(flag));
if (unknown.length > 0) {
  process.stderr.write(
    `Usage: bun run convert:day-reports [--dry-run] [--undo]\nUnknown: ${unknown.join(' ')}\n`,
  );
  process.exit(2);
}
const dryRun = flags.includes('--dry-run');
const undo = flags.includes('--undo');

const databaseUrl = Bun.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  process.stderr.write('DATABASE_URL is not set.\n');
  process.exit(2);
}

const run: Effect.Effect<
  object,
  DayReportConversionError,
  SqlClient.SqlClient
> = undo ? undoConvertedReports({ dryRun }) : convertStoredReports({ dryRun });
const exit = await Effect.runPromiseExit(
  run.pipe(Effect.provide(pgClientLayer(databaseUrl))),
);

if (Exit.isSuccess(exit)) {
  process.stdout.write(`${JSON.stringify(exit.value)}\n`);
} else {
  // Only the message: a database error underneath can quote a row.
  const error = Cause.findErrorOption(exit.cause);
  const message =
    error._tag === 'Some' && error.value instanceof Error
      ? error.value.message
      : 'The conversion stopped unexpectedly, and changed nothing.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
