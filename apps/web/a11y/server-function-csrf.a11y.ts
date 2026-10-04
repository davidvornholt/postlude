import { expect, test } from '@playwright/test';

const forbidden = 403;
const untrustedRequestHeaders: ReadonlyArray<Record<string, string>> = [
  { 'sec-fetch-site': 'cross-site' },
  { 'sec-fetch-site': 'same-site' },
  { origin: 'https://attacker.invalid' },
  {},
];

// src/start.ts declares the CSRF check that TanStack applies implicitly only
// when an app has no start instance; this guards that declaration end to end.
// The check runs before the function lookup, so an unknown id still gets its
// 403. Real same-origin calls are covered by the authenticated specs.
test('server functions refuse requests that are not same-origin', async ({
  request,
}) => {
  for (const headers of untrustedRequestHeaders) {
    const response = await request.post('/_serverFn/csrf-probe', {
      headers: { 'x-tsr-serverFn': 'true', ...headers },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(forbidden);
    expect(await response.text()).toBe('Forbidden');
  }
});
