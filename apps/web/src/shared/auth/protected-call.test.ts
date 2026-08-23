import { describe, expect, it } from 'bun:test';

import { runProtectedCall } from './protected-call.ts';

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
    await expect(result).rejects.toMatchObject({ status: 401 });
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
