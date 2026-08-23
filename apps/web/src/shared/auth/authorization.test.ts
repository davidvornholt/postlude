import { describe, expect, it } from 'bun:test';

import {
  authorizeSession,
  createGitHubProfileMapper,
} from './authorization.ts';

const allowedAccountId = '157214705';
const session = { user: { name: 'David' } };

describe('GitHub account authorization', () => {
  it('accepts only the configured numeric ID even when logins match', () => {
    const mapProfile = createGitHubProfileMapper(allowedAccountId);
    expect(
      mapProfile({ id: allowedAccountId, login: 'davidvornholt' }),
    ).toEqual({ name: 'davidvornholt' });
    expect(() =>
      mapProfile({ id: '999999999', login: 'davidvornholt' }),
    ).toThrow('This application is private.');
  });

  it('accepts a session linked to the configured GitHub account', async () => {
    const result = await authorizeSession({
      allowedAccountId,
      getSession: () => Promise.resolve(session),
      getAccounts: () =>
        Promise.resolve([
          { providerId: 'github', accountId: allowedAccountId },
        ]),
      revokeSession: () => Promise.reject(new Error('must not revoke')),
    });
    expect(result).toBe(session);
  });

  it('revokes a session linked to a different account ID', async () => {
    let revoked = false;
    const result = await authorizeSession({
      allowedAccountId,
      getSession: () => Promise.resolve(session),
      getAccounts: () =>
        Promise.resolve([{ providerId: 'github', accountId: '999999999' }]),
      revokeSession: () => {
        revoked = true;
        return Promise.resolve();
      },
    });
    expect(result).toBeNull();
    expect(revoked).toBeTrue();
  });

  it('does not query accounts without a session', async () => {
    let queriedAccounts = false;
    const result = await authorizeSession({
      allowedAccountId,
      getSession: () => Promise.resolve(null),
      getAccounts: () => {
        queriedAccounts = true;
        return Promise.resolve([]);
      },
      revokeSession: () => Promise.resolve(),
    });
    expect(result).toBeNull();
    expect(queriedAccounts).toBeFalse();
  });
});
