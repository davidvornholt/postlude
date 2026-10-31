/**
 * What the evening says when an action didn't go through.
 *
 * A refusal the server explains, such as a closed day or a day that hasn't
 * begun, is shown in the server's own words. Anything else is reduced to what
 * the writer can do about it, because a raw error says nothing useful and may
 * say something it shouldn't.
 */

import {
  closedDayNeededMessage,
  dayClosedMessage,
  futureDayMessage,
  ratingsNeededMessage,
} from './evening-messages.ts';

export const eveningSignInMessage =
  'Your sign-in ended, so this was not saved. Sign in again and try once more.';
export const eveningConnectionMessage =
  'This did not reach the journal. Check the connection and try again.';
export const unsavedWritingMessage =
  'The writing above is not saved yet, so the day was left as it was. Once it saves, try again.';

const explainedRefusals = [
  closedDayNeededMessage,
  dayClosedMessage,
  futureDayMessage,
  ratingsNeededMessage,
] as const;

const unauthorizedStatus = 401;
const forbiddenStatus = 403;

const property = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;

export const eveningFailureMessageOf = (error: unknown): string => {
  const status = property(error, 'status');
  const message = property(error, 'message');
  if (
    status === unauthorizedStatus ||
    status === forbiddenStatus ||
    message === 'Not authorized.'
  ) {
    return eveningSignInMessage;
  }
  if (typeof message === 'string') {
    const refusal = explainedRefusals.find((known) => message.includes(known));
    if (refusal !== undefined) {
      return refusal;
    }
  }
  return eveningConnectionMessage;
};

/**
 * A server function may resolve with a failed response instead of rejecting.
 * This turns that into the rejection the caller expects, with the response's
 * text as the message.
 */
export const rejectFailedResponse = async <T>(result: T): Promise<T> => {
  if (result instanceof Response && !result.ok) {
    const message = await result.text();
    throw Object.assign(new Error(message), { status: result.status });
  }
  return result;
};
