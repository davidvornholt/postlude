/**
 * What the journal's service boundary is allowed to fail with.
 *
 * Errors are split by what the reader can do about them rather than by what went
 * wrong underneath. A read failure is worth retrying. A validation failure
 * needs a correction. A database write failure means words were not saved and
 * may clear on another attempt.
 *
 * `message` is written to be shown. A database error underneath carries a
 * connection string and a statement, neither of which belongs on a page or in a
 * response, so the cause is logged and the message is not built from it.
 */

import { Data } from 'effect';

export const journalWriteMessage =
  'This entry could not be saved. Your words are still here; check your connection.';
export const journalWriteConflictMessage =
  'This entry changed in another tab. Your unsaved words are still here; copy them before reloading.';

export const invalidScriptureReferenceMessage =
  'Check the scripture reference and use a form such as Proverbs 12:5-13.';

export class JournalReadError extends Data.TaggedError('JournalReadError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class JournalWriteError extends Data.TaggedError('JournalWriteError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class JournalWriteConflictError extends Data.TaggedError(
  'JournalWriteConflictError',
)<{
  readonly message: string;
}> {}

export class JournalValidationError extends Data.TaggedError(
  'JournalValidationError',
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const journalReadError = (cause: unknown): JournalReadError =>
  new JournalReadError({
    message: 'The journal could not be read. Trying again usually works.',
    cause,
  });

export const journalWriteError = (cause: unknown): JournalWriteError =>
  new JournalWriteError({
    message: journalWriteMessage,
    cause,
  });

export const journalWriteConflictError = (): JournalWriteConflictError =>
  new JournalWriteConflictError({
    message: journalWriteConflictMessage,
  });

export const invalidScriptureReferenceError = (): JournalValidationError =>
  new JournalValidationError({
    message: invalidScriptureReferenceMessage,
  });
