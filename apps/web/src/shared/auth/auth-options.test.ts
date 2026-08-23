import { describe, expect, it } from 'bun:test';
import { symmetricEncrypt } from 'better-auth/crypto';
import { decryptOAuthToken, setTokenUtil } from 'better-auth/oauth2';

import { createAuthOptions } from './auth-options.ts';

const providerToken = 'github-provider-token';
const testSecret = 'oauth-test-secret-with-at-least-32-characters';

const authOptions = createAuthOptions({
  allowedGitHubAccountId: '157214705',
  baseURL: 'http://localhost:3000',
  githubClientId: 'test-client-id',
  githubClientSecret: 'test-client-secret',
  secret: testSecret,
});

const tokenContext = {
  options: { account: authOptions.account },
  secretConfig: testSecret,
} as unknown as Parameters<typeof setTokenUtil>[1];

describe('OAuth token persistence', () => {
  it('encrypts a provider token before persistence and decrypts it for use', async () => {
    const persisted = await setTokenUtil(providerToken, tokenContext);
    if (!persisted) {
      throw new Error('better-auth did not return an encrypted token.');
    }
    expect(persisted).not.toBe(providerToken);
    expect(await decryptOAuthToken(persisted, tokenContext)).toBe(
      providerToken,
    );
  });

  it('keeps existing plaintext rows readable until the next token update', async () => {
    expect(await decryptOAuthToken(providerToken, tokenContext)).toBe(
      providerToken,
    );
  });

  it('uses the same ciphertext envelope as the configured encryption utility', async () => {
    const persisted = await symmetricEncrypt({
      key: testSecret,
      data: providerToken,
    });
    expect(await decryptOAuthToken(persisted, tokenContext)).toBe(
      providerToken,
    );
  });
});
