/**
 * What the journal's service boundary is allowed to fail with.
 *
 * Two errors, split by what the reader can do about them rather than by what
 * went wrong underneath. A read that fails leaves the page with nothing to show
 * and is worth retrying. A write that fails means words the writer typed are not
 * saved, which is the only failure in Postlude that costs something that cannot
 * be recovered by trying again later — so it is a separate tag, and the writing
 * page treats it as one.
 *
 * `message` is written to be shown. A database error underneath carries a
 * connection string and a statement, neither of which belongs on a page or in a
 * response, so the cause is logged and the message is not built from it.
 */

import { Data } from 'effect';

export class JournalReadError extends Data.TaggedError('JournalReadError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class JournalWriteError extends Data.TaggedError('JournalWriteError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export const journalReadError = (cause: unknown): JournalReadError =>
  new JournalReadError({
    message: 'The journal could not be read. Trying again usually works.',
    cause,
  });

export const journalWriteError = (cause: unknown): JournalWriteError =>
  new JournalWriteError({
    message:
      'This entry could not be saved. Your words are still here; check your connection.',
    cause,
  });
