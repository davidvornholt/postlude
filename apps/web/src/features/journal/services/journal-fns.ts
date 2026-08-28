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
import {
  loadAfterConfirmedRevision,
  loadClassifiedAfterConfirmedRevision,
} from '../confirmed-revision-loader.ts';
import { type JournalDate, journalDateAt } from '../journal-day.ts';
import { decodeSaveConfirmation } from '../save-confirmation.ts';
import {
  type EntryDraft,
  EntryDraftSchema,
  type SaveConfirmation,
} from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';
import { makeJournalDayReader } from './journal-day-reader.ts';
import { runJournalEffect } from './journal-runtime.ts';
import { decodeReadDatedEntryInput } from './read-entry-input.ts';

/** Today as the configured zone reads it, with the 04:00 rule applied. */
export const currentJournalDate = (): JournalDate =>
  journalDateAt(new Date(), env.JOURNAL_TIME_ZONE);

const decodeDraft = Schema.decodeUnknownSync(EntryDraftSchema);

/**
 * A day's page: the entry and what the server's clock calls today.
 *
 * Today comes back with the entry rather than being asked for separately,
 * because every page needs both and the two have to agree. A page that read
 * the day from the browser could offer to write a day the server would refuse,
 * or call yesterday "today" for a reader who has travelled.
 *
 */
const journalDayReader = makeJournalDayReader(runJournalEffect);

/** Today is selected only from the configured server clock. */
export const readTodayJournalDayFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .handler(() => {
    const today = currentJournalDate();
    return journalDayReader.readToday(today);
  });

/**
 * The route-facing read repeats a snapshot that started before this browser's
 * last confirmed save. Each repeat reaches the same primary database after the
 * save response arrived, so it must include that revision.
 */
export const readDatedJournalDayFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeReadDatedEntryInput(input))
  .handler(({ data }) => {
    const today = currentJournalDate();
    return journalDayReader.readDated(data.date, today);
  });

export const readTodayJournalDay = () =>
  loadAfterConfirmedRevision(() => readTodayJournalDayFn());

export const readDatedJournalDay = (input: {
  readonly data: { readonly date: JournalDate };
}) => {
  let startedReadable = false;
  return loadClassifiedAfterConfirmedRevision(
    () => readDatedJournalDayFn(input),
    (result) => {
      if (result.disposition !== 'readable') {
        if (startedReadable) {
          throw new Error('The requested journal day changed classification.');
        }
        return;
      }
      startedReadable = true;
      return result.view;
    },
  );
};

/**
 * Saves a day and returns the database-issued revision of that write. The
 * client uses it to reject a stale loader snapshot after navigating away and
 * back while a save completes.
 */
export const saveEntryFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeDraft(input))
  .handler(
    ({ data }): Promise<SaveConfirmation> =>
      runJournalEffect(
        Effect.gen(function* () {
          const entries = yield* EntryRepository;
          const entry = yield* entries.save(data);
          return { revision: entry.revision };
        }),
      ),
  );

/**
 * The same save, as the plain call the writing page takes. A server function is
 * invoked as `fn({ data })` rather than as `fn(draft)`, and the page should not
 * have to know that — it holds a draft and wants it written.
 */
export const saveDraft = async (
  draft: EntryDraft,
): Promise<SaveConfirmation> => {
  const result: unknown = await saveEntryFn({ data: draft });
  return decodeSaveConfirmation(result);
};
