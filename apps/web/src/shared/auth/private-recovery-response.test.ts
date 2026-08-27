import { describe, expect, it } from 'bun:test';

import {
  privateHtmlRecoveryResponse,
  privateResponseHeaders,
} from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';
import { runSessionRequired } from './session-required.ts';

const internalServerError = 500;
const serviceUnavailable = 503;

const recoveryResponse = (): Response =>
  privateHtmlRecoveryResponse({
    actionHref: '/archive',
    actionLabel: 'Return to archive',
    heading: 'Export unavailable',
    message: 'The export could not be prepared.',
    title: 'Export unavailable | Postlude',
  });

const caughtResponse = async (promise: Promise<unknown>): Promise<Response> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to reject with a Response.');
};

describe('approved private recovery responses', () => {
  it('keeps the factory response intact through the authenticated boundary', async () => {
    const response = recoveryResponse();
    const result = await runSessionRequired({
      request: new Request('https://postlude.test/archive/export', {
        method: 'POST',
      }),
      authorize: () => Promise.resolve(true),
      next: () => Promise.resolve(response),
      publishHeaders: () => undefined,
    });

    expect(result).toBe(response);
    expect(response.status).toBe(serviceUnavailable);
    expect(response.headers.get('cache-control')).toBe(
      privateResponseHeaders['cache-control'],
    );
    expect(response.headers.get('pragma')).toBe(privateResponseHeaders.pragma);
    expect(response.headers.get('x-content-type-options')).toBe(
      privateResponseHeaders['x-content-type-options'],
    );
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
  });

  it('keeps approved nested and thrown responses without widening approval', async () => {
    const nested = recoveryResponse();
    const nestedResult = await runProtectedCall({
      authorize: () => Promise.resolve(true),
      next: () => Promise.resolve({ result: nested }),
      publishHeaders: () => undefined,
    });
    const thrown = recoveryResponse();
    const thrownResult = await caughtResponse(
      runProtectedCall({
        authorize: () => Promise.resolve(true),
        next: () => Promise.reject(thrown),
        publishHeaders: () => undefined,
      }),
    );

    expect(nestedResult.result).toBe(nested);
    expect(thrownResult).toBe(thrown);
  });

  it('sanitizes arbitrary, cloned, and look-alike downstream responses', async () => {
    const approved = recoveryResponse();
    const candidates = [
      new Response('private journal body', {
        status: serviceUnavailable,
        headers: privateResponseHeaders,
      }),
      approved.clone(),
      { result: new Response('nested private journal body', { status: 503 }) },
    ];

    const responses = await Promise.all(
      candidates.map((candidate) =>
        caughtResponse(
          runProtectedCall({
            authorize: () => Promise.resolve(true),
            next: () => Promise.resolve(candidate),
            publishHeaders: () => undefined,
          }),
        ),
      ),
    );

    const bodies = await Promise.all(
      responses.map((response) => response.text()),
    );
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(internalServerError);
      expect(bodies[index]).toBe('The journal request could not be completed.');
    }
  });
});
