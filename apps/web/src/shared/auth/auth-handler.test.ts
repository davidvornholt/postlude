import { describe, expect, it } from 'bun:test';
import { createAuthorizedAuthHandler } from './auth-handler';

const unauthorized = 401;
const unavailable = 503;
const allowedAccountId = '123';
const endpoints = [
  '/get-session',
  '/list-accounts',
  '/list-sessions',
  '/update-user',
];
const liveSession = { user: { name: 'Owner' } };
const authorizedAccount = { providerId: 'github', accountId: allowedAccountId };

describe('auth HTTP account authorization', () => {
  it('blocks all auth endpoints and revokes drifted sessions before delegation', async () => {
    let delegated = 0;
    let revoked = 0;
    const handler = createAuthorizedAuthHandler({
      allowedAccountId,
      api: {
        getSession: () => Promise.resolve(liveSession),
        listUserAccounts: () =>
          Promise.resolve([{ ...authorizedAccount, accountId: '999' }]),
        signOut: () => {
          revoked += 1;
          return Promise.resolve();
        },
      },
      handler: () => {
        delegated += 1;
        return Promise.resolve(new Response());
      },
    });
    await Promise.all(
      endpoints.map(async (path) => {
        const response = await handler(
          new Request(`http://localhost/api/auth${path}`),
        );
        expect(response.status).toBe(unauthorized);
        expect(response.headers.get('cache-control')).toBe('no-store');
      }),
    );
    expect(delegated).toBe(0);
    expect(revoked).toBe(endpoints.length);
  });
  it('delegates anonymous OAuth and authorized sessions unchanged', async () => {
    for (const session of [null, liveSession]) {
      const response = new Response('provider response', {
        status: 302,
        headers: { location: '/login' },
      });
      const handler = createAuthorizedAuthHandler({
        allowedAccountId,
        api: {
          getSession: () => Promise.resolve(session),
          listUserAccounts: () => Promise.resolve([authorizedAccount]),
          signOut: () => Promise.reject(new Error('must not revoke')),
        },
        handler: () => Promise.resolve(response),
      });
      expect(
        // biome-ignore lint/performance/noAwaitInLoops: Isolated sequential session-state probes.
        await handler(new Request('http://localhost/api/auth/callback/github')),
      ).toBe(response);
    }
  });
  it('denies drift even if revocation fails', async () => {
    const handler = createAuthorizedAuthHandler({
      allowedAccountId,
      api: {
        getSession: () => Promise.resolve(liveSession),
        listUserAccounts: () => Promise.resolve([]),
        signOut: () => Promise.reject(new Error('storage unavailable')),
      },
      handler: () => Promise.reject(new Error('must not delegate')),
    });
    expect(
      (await handler(new Request('http://localhost/api/auth/update-user')))
        .status,
    ).toBe(unauthorized);
  });
  it('fails closed without returning database diagnostics when authorization storage fails', async () => {
    const handler = createAuthorizedAuthHandler({
      allowedAccountId,
      api: {
        getSession: () => Promise.resolve(liveSession),
        listUserAccounts: () =>
          Promise.reject(new Error('select private_account from private_host')),
        signOut: () => Promise.resolve(),
      },
      handler: () => Promise.reject(new Error('must not delegate')),
    });
    const response = await handler(
      new Request('http://localhost/api/auth/get-session'),
    );
    expect(response.status).toBe(unavailable);
    expect(await response.text()).not.toContain('private_');
  });
});
