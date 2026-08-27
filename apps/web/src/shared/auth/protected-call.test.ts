import { describe, expect, it, mock } from 'bun:test';
import { Effect, Schema } from 'effect';

import { applyPrivateResponseHeaders } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';

const badRequest = 400;
const unauthorized = 401;
const internalServerError = 500;
const expectedPrivateHeaders = {
  cacheControl: 'private, no-store, max-age=0',
  pragma: 'no-cache',
  contentTypeOptions: 'nosniff',
};

const privateHeadersOf = (headers: Headers) => ({
  cacheControl: headers.get('cache-control'),
  pragma: headers.get('pragma'),
  contentTypeOptions: headers.get('x-content-type-options'),
});

const responseFrom = async (promise: Promise<unknown>): Promise<Response> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the protected call to reject with a Response.');
};

const protectedCall = <T>(
  authorize: () => Promise<boolean>,
  next: () => Promise<T>,
) => {
  const publishedHeaders = new Headers();
  const publishHeaders = mock(() =>
    applyPrivateResponseHeaders(publishedHeaders),
  );
  return {
    result: runProtectedCall({ authorize, next, publishHeaders }),
    publishHeaders,
    publishedHeaders,
  };
};

describe('server-function authorization', () => {
  it('rejects with 401 before calling the protected operation', async () => {
    let called = false;
    const { result, publishHeaders, publishedHeaders } = protectedCall(
      () => Promise.resolve(false),
      () => {
        called = true;
        return Promise.resolve('sensitive data');
      },
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(unauthorized);
    expect(await response.text()).toBe('Not authorized.');
    expect(privateHeadersOf(response.headers)).toEqual(expectedPrivateHeaders);
    expect(publishHeaders).toHaveBeenCalledTimes(1);
    expect(privateHeadersOf(publishedHeaders)).toEqual(expectedPrivateHeaders);
    expect(called).toBeFalse();
  });

  it('publishes the private response policy before returning journal data', async () => {
    const { result, publishHeaders, publishedHeaders } = protectedCall(
      () => Promise.resolve(true),
      () => Promise.resolve('sensitive data'),
    );

    expect(await result).toBe('sensitive data');
    expect(publishHeaders).toHaveBeenCalledTimes(1);
    expect(privateHeadersOf(publishedHeaders)).toEqual(expectedPrivateHeaders);
  });
});

describe('server-function failures', () => {
  it('returns a safe private 500 when authorization fails operationally', async () => {
    let called = false;
    const { result } = protectedCall(
      () => Promise.reject(new Error('session lookup failed')),
      () => {
        called = true;
        return Promise.resolve('sensitive data');
      },
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(internalServerError);
    expect(await response.text()).toBe(
      'The journal request could not be completed.',
    );
    expect(privateHeadersOf(response.headers)).toEqual(expectedPrivateHeaders);
    expect(called).toBeFalse();
  });

  it('returns a safe private 400 for malformed input', async () => {
    const { result } = protectedCall(
      () => Promise.resolve(true),
      () => Promise.resolve(Schema.decodeUnknownSync(Schema.String)(null)),
    );
    const response = await responseFrom(result);

    expect(response.status).toBe(badRequest);
    expect(await response.text()).toBe('Invalid request.');
    expect(privateHeadersOf(response.headers)).toEqual(expectedPrivateHeaders);
  });

  it('keeps an approved journal validation message and hides operational details', async () => {
    const validation = await Effect.runPromise(
      Effect.fail({
        _tag: 'JournalValidationError',
        message: 'Check the scripture reference.',
      }),
    ).catch((error: unknown) => error);
    const validationResponse = await responseFrom(
      protectedCall(
        () => Promise.resolve(true),
        () => Promise.reject(validation),
      ).result,
    );
    const operationalResponse = await responseFrom(
      protectedCall(
        () => Promise.resolve(true),
        () => Promise.reject(new Error('postgres://secret@database')),
      ).result,
    );
    const rawResponse = await responseFrom(
      protectedCall(
        () => Promise.resolve(true),
        () =>
          Promise.reject(
            new Response('private journal text', { status: badRequest }),
          ),
      ).result,
    );
    const resolvedRawResponse = await responseFrom(
      protectedCall(
        () => Promise.resolve(true),
        () =>
          Promise.resolve(
            new Response('resolved private journal text', {
              status: internalServerError,
            }),
          ),
      ).result,
    );

    expect(validationResponse.status).toBe(badRequest);
    expect(await validationResponse.text()).toBe(
      'Check the scripture reference.',
    );
    expect(privateHeadersOf(validationResponse.headers)).toEqual(
      expectedPrivateHeaders,
    );
    expect(operationalResponse.status).toBe(internalServerError);
    expect(await operationalResponse.text()).not.toContain('secret');
    expect(privateHeadersOf(operationalResponse.headers)).toEqual(
      expectedPrivateHeaders,
    );
    expect(rawResponse.status).toBe(internalServerError);
    expect(await rawResponse.text()).not.toContain('private journal text');
    expect(privateHeadersOf(rawResponse.headers)).toEqual(
      expectedPrivateHeaders,
    );
    expect(resolvedRawResponse.status).toBe(internalServerError);
    expect(await resolvedRawResponse.text()).not.toContain(
      'resolved private journal text',
    );
    expect(privateHeadersOf(resolvedRawResponse.headers)).toEqual(
      expectedPrivateHeaders,
    );
  });
});
