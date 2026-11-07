/**
 * `db:seed:preview`: fills a pull request preview's database with a made-up
 * journal, so a preview has days to look at from its first visit.
 *
 * The preview host runs it in the release image after migrations, with only
 * `DATABASE_URL` and `HOME` set, no network and a read-only root. A database
 * that already holds a journal is left as it is, so running it again, or by
 * mistake against a real journal, changes nothing.
 *
 * The journal has no owner: whoever signs in reads it, and the sign-in itself
 * decides who may. Its days are counted back from the current journal day in
 * `JOURNAL_TIME_ZONE`, Europe/Berlin unless that says otherwise, the zone the
 * previews serve.
 */

import process from 'node:process';
import { pgClientLayer } from '@postlude/db/connections';
import { Cause, Effect, Exit, Layer } from 'effect';
import { samplePlan } from '../src/features/journal/sample/sample-plan.ts';
import { seedSampleJournal } from '../src/features/journal/sample/sample-seed.ts';
import { EntryRepository } from '../src/features/journal/services/entry-repository.ts';
import { isTimeZone } from '../src/shared/time-zone.ts';

const previewTimeZone = 'Europe/Berlin';

const databaseUrl = Bun.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is not set.');
}
const timeZone = Bun.env.JOURNAL_TIME_ZONE || previewTimeZone;
if (!isTimeZone(timeZone)) {
  throw new Error(`JOURNAL_TIME_ZONE is not a time zone: ${timeZone}`);
}

const sqlLayer = pgClientLayer(databaseUrl);
const exit = await Effect.runPromiseExit(
  seedSampleJournal(samplePlan({ now: new Date(), timeZone })).pipe(
    Effect.provide(Layer.provideMerge(EntryRepository.layer, sqlLayer)),
  ),
);

if (Exit.isFailure(exit)) {
  process.stderr.write(
    `The sample journal was not stored.\n${Cause.pretty(exit.cause)}\n`,
  );
  process.exitCode = 1;
} else if (exit.value.seeded) {
  const { today, entries, ratings, agentAreas } = exit.value;
  process.stdout.write(
    `Stored a sample journal up to ${today}: ${entries} entries, ${ratings} ratings, ${agentAreas} days with agent data.\n`,
  );
} else {
  process.stdout.write(
    'The database already holds a journal, so nothing was changed.\n',
  );
}
