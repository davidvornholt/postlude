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
import { loadAfterConfirmedRevision } from '../confirmed-revisions.ts';
import {
  type Anniversary,
  anniversaryLimit,
  anniversaryOf,
  isoMonthStart,
} from '../anniversary.ts';
import { type JournalDate, journalDateAt } from '../journal-day.ts';
import { decodeSaveConfirmation } from '../save-confirmation.ts';
import {
  type EntryDraft,
  EntryDraftSchema,
  emptyJournalEntry,
  type JournalEntry,
  type SaveConfirmation,
} from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';
import { runJournalEffect } from './journal-runtime.ts';
import { decodeReadEntryInput } from './read-entry-input.ts';

/** Today as the configured zone reads it, with the 04:00 rule applied. */
export const currentJournalDate = (): JournalDate =>
  journalDateAt(new Date(), env.JOURNAL_TIME_ZONE);

const decodeDraft = Schema.decodeUnknownSync(EntryDraftSchema);

/**
 * A day's page: the entry, what the server's clock calls today, and the same
 * date in the years behind it.
 *
 * Today comes back with the entry rather than being asked for separately,
 * because every page needs both and the two have to agree. A page that read
 * the day from the browser could offer to write a day the server would refuse,
 * or call yesterday "today" for a reader who has travelled.
 *
 * The anniversaries come back in the same round trip for the same reason the
 * counts do: they are part of what the page is, and a second request for them
 * would let the page render once without them and shift under the reader.
 */
export type JournalDayView = {
  readonly entry: JournalEntry;
  readonly today: JournalDate;
  readonly anniversaries: ReadonlyArray<Anniversary>;
};

/**
 * One day, blank when it has never been written. The date is optional: with
 * none, the server decides today from its own clock rather than believing a
 * client's, which is what keeps "today" the same page on every device.
 */
export const readJournalDayFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeReadEntryInput(input ?? {}))
  .handler(({ data }): Promise<JournalDayView> => {
    const today = currentJournalDate();
    const date = data.date ?? today;
    return runJournalEffect(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const entry = yield* entries.read(date);
        const earlier = yield* entries.readAnniversaries(
          date.slice(isoMonthStart),
          date,
          anniversaryLimit,
        );
        return {
          entry: entry ?? emptyJournalEntry(date),
          today,
          anniversaries: earlier.map(anniversaryOf(date)),
        };
      }),
    );
  });

/**
 * The route-facing read repeats a snapshot that started before this browser's
 * last confirmed save. Each repeat reaches the same primary database after the
 * save response arrived, so it must include that revision.
 */
export const readJournalDay = (input?: {
  readonly data: { readonly date: JournalDate };
}): Promise<JournalDayView> =>
  loadAfterConfirmedRevision(() =>
    input === undefined ? readJournalDayFn() : readJournalDayFn(input),
  );

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
