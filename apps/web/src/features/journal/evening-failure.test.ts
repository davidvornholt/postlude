import { describe, expect, it } from 'bun:test';

import {
  eveningConnectionMessage,
  eveningFailureMessageOf,
  eveningSignInMessage,
  rejectFailedResponse,
} from './evening-failure.ts';
import { dayClosedMessage, futureDayMessage } from './evening-messages.ts';

describe('eveningFailureMessageOf', () => {
  it("passes on the server's explanation of a refusal", () => {
    expect(eveningFailureMessageOf(new Error(dayClosedMessage))).toBe(
      dayClosedMessage,
    );
    expect(eveningFailureMessageOf({ message: futureDayMessage })).toBe(
      futureDayMessage,
    );
  });

  it('asks for a new sign-in when the session ended', () => {
    expect(eveningFailureMessageOf({ status: 401, message: 'x' })).toBe(
      eveningSignInMessage,
    );
    expect(eveningFailureMessageOf(new Error('Not authorized.'))).toBe(
      eveningSignInMessage,
    );
  });

  it('never shows an unexplained error as it came', () => {
    expect(
      eveningFailureMessageOf(
        new Error('relation "day_rating" does not exist'),
      ),
    ).toBe(eveningConnectionMessage);
    expect(eveningFailureMessageOf(undefined)).toBe(eveningConnectionMessage);
  });
});

describe('rejectFailedResponse', () => {
  it('rejects a failed response with its text and status', async () => {
    const failed = rejectFailedResponse(
      new Response(dayClosedMessage, { status: 400 }),
    );
    await expect(failed).rejects.toMatchObject({
      message: dayClosedMessage,
      status: 400,
    });
  });

  it('passes anything else through', async () => {
    const value = { energy: 'okay' };
    expect(await rejectFailedResponse(value)).toBe(value);
  });
});
