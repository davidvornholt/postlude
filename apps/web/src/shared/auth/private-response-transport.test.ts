import { describe, expect, it } from 'bun:test';
import {
  getResponseHeaders,
  requestHandler,
} from '@tanstack/react-start/server';
import { Schema } from 'effect';

import { applyPrivateResponseHeaders } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';

const ok = 200;
const unauthorized = 401;
const badRequest = 400;
const internalServerError = 500;

const privateHeadersOf = (headers: Headers) => ({
  cacheControl: headers.get('cache-control'),
  pragma: headers.get('pragma'),
  contentTypeOptions: headers.get('x-content-type-options'),
});

const expectedPrivateHeaders = {
  cacheControl: 'private, no-store, max-age=0',
  pragma: 'no-cache',
  contentTypeOptions: 'nosniff',
};

const transportedCall = ({
  authorize,
  next,
}: {
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<Response>;
}): Promise<Response> => {
  const handler = requestHandler(async () => {
    try {
      return await runProtectedCall({
        authorize,
        next,
        publishHeaders: () => applyPrivateResponseHeaders(getResponseHeaders()),
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      throw error;
    }
  });
  return Promise.resolve(
    handler(new Request('https://postlude.test/server-function'), {}),
  );
};

describe('private response production transport', () => {
  it('adds the private policy to an authenticated journal response', async () => {
    const response = await transportedCall({
      authorize: () => Promise.resolve(true),
      next: () => Promise.resolve(new Response('private journal text')),
    });

    expect(response.status).toBe(ok);
    expect(await response.text()).toBe('private journal text');
    expect(privateHeadersOf(response.headers)).toEqual(expectedPrivateHeaders);
  });

  it('keeps safe private responses intact across error transports', async () => {
    const responses = await Promise.all([
      transportedCall({
        authorize: () => Promise.resolve(false),
        next: () => Promise.resolve(new Response('unreachable private text')),
      }),
      transportedCall({
        authorize: () => Promise.resolve(true),
        next: () => {
          Schema.decodeUnknownSync(Schema.String)(null);
          return Promise.resolve(new Response('unreachable private text'));
        },
      }),
      transportedCall({
        authorize: () => Promise.resolve(true),
        next: () => Promise.reject(new Error('database password leaked')),
      }),
    ]);
    const expected = [
      { status: unauthorized, body: 'Not authorized.' },
      { status: badRequest, body: 'Invalid request.' },
      {
        status: internalServerError,
        body: 'The journal request could not be completed.',
      },
    ];
    const bodies = await Promise.all(
      responses.map((response) => response.text()),
    );

    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(expected[index]?.status);
      expect(bodies[index]).toBe(expected[index]?.body);
      expect(privateHeadersOf(response.headers)).toEqual(
        expectedPrivateHeaders,
      );
    }
  });
});
