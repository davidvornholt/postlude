import { describe, expect, it } from 'bun:test';

import { runProtectedCall } from './protected-call.ts';

const unauthorizedStatus = 401;

describe('server-function authorization', () => {
  it('rejects with 401 before calling the protected operation', async () => {
    let called = false;
    const result = runProtectedCall({
      authorize: () => Promise.resolve(false),
      next: () => {
        called = true;
        return Promise.resolve('sensitive data');
      },
    });
    const response = await result.catch((error: unknown) => error);
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new TypeError('Expected the authorization boundary to respond.');
    }
    expect(response.status).toBe(unauthorizedStatus);
    const document = await response.text();
    expect(document).toContain('Your session ended.');
    expect(document).toContain('href="/login"');
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(called).toBeFalse();
  });

  it('runs the protected operation for an authorized session', async () => {
    const result = await runProtectedCall({
      authorize: () => Promise.resolve(true),
      next: () => Promise.resolve('sensitive data'),
    });
    expect(result).toBe('sensitive data');
  });

  it('propagates a failing authorization check instead of allowing the call', async () => {
    let called = false;
    const result = runProtectedCall({
      authorize: () => Promise.reject(new Error('session lookup failed')),
      next: () => {
        called = true;
        return Promise.resolve('sensitive data');
      },
    });
    await expect(result).rejects.toThrow('session lookup failed');
    expect(called).toBeFalse();
  });
});
