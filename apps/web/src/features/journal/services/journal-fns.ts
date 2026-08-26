/**
 * The journal's server functions: the boundary the browser reaches the database
 * through.
 *
 * Every one of them carries `sessionRequired`. Postlude has exactly one allowed
 * account and these read and write everything it has ever written, so an
 * unguarded one would be the whole journal, readable by anyone who found the
 * address. `sensitive-server-fns.test.ts` fails the build if one loses its
 * guard, and that test is the reason the middleware is attached here rather than
 * checked inside a handler.
 *
 * Input arrives as `unknown` and is decoded before it reaches a query. What
 * crosses this boundary is whatever the network delivered, whatever the types on
 * the client said.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { env } from '#/shared/env.ts';
import { runServerEffect } from '#/shared/runtime/app-runtime.ts';
import { type JournalDate, journalDateAt } from '../journal-day.ts';
import {
  EntryDraftSchema,
  emptyJournalEntry,
  type JournalEntry,
} from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';
import { decodeReadEntryInput } from './read-entry-input.ts';

/** Today as the configured zone reads it, with the 04:00 rule applied. */
export const currentJournalDate = (): JournalDate =>
  journalDateAt(new Date(), env.JOURNAL_TIME_ZONE);

const decodeDraft = Schema.decodeUnknownSync(EntryDraftSchema);

/**
 * One day, blank when it has never been written. The date is optional: with
 * none, the server decides today from its own clock rather than believing a
 * client's, which is what keeps "today" the same page on every device.
 */
export const readEntryFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .inputValidator((input: unknown) => decodeReadEntryInput(input))
  .handler(({ data }): Promise<JournalEntry> => {
    const date = data.date ?? currentJournalDate();
    return runServerEffect(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const entry = yield* entries.read(date);
        return entry ?? emptyJournalEntry(date);
      }),
    );
  });

/**
 * Saves a day and hands back what the table now holds, counts included. The
 * counts come back rather than being computed twice, so what the writer is
 * shown is what the archive will bucket the day by.
 */
export const saveEntryFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .inputValidator((input: unknown) => decodeDraft(input))
  .handler(
    ({ data }): Promise<JournalEntry> =>
      runServerEffect(
        Effect.gen(function* () {
          const entries = yield* EntryRepository;
          return yield* entries.save(data);
        }),
      ),
  );
