import type { AutosaveFailure } from './autosave.ts';
import {
  invalidScriptureReferenceMessage,
  journalWriteMessage,
} from './errors/journal-errors.ts';

export const authenticationSaveMessage =
  'Your sign-in ended before this entry could be saved. Your words are kept in this tab.';
const unauthorizedStatus = 401;
const forbiddenStatus = 403;

const property = (error: unknown, key: string): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/** Reduces browser failures to messages that are safe and useful to act on. */
export const autosaveFailureOf = (error: unknown): AutosaveFailure => {
  const status = property(error, 'status');
  if (status === unauthorizedStatus || status === forbiddenStatus) {
    return { kind: 'authentication', message: authenticationSaveMessage };
  }

  const message = property(error, 'message');
  if (
    typeof message === 'string' &&
    message.includes(invalidScriptureReferenceMessage)
  ) {
    return {
      kind: 'validation',
      field: 'scriptureReference',
      message: invalidScriptureReferenceMessage,
    };
  }

  return { kind: 'network', message: journalWriteMessage };
};
