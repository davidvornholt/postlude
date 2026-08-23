import { afterAll, describe, expect, it } from 'bun:test';
import { rm, symlink } from 'node:fs/promises';

import { createFetchHandler } from './serve.ts';

const okStatus = 200;

const ssrMarker = 'ssr-handled';
const assetPath = '/assets/app-abcd1234.js';
const immutableCache = 'public, max-age=31536000, immutable';
const secretBody = 'outside-the-client-directory';

const root = `${Bun.env.TMPDIR ?? '/tmp'}/postlude-serve-${crypto.randomUUID()}`;
const clientDir = `${root}/client`;

await Bun.write(`${clientDir}/index.html`, '<!doctype html>index');
await Bun.write(`${clientDir}/favicon.svg`, '<svg />');
await Bun.write(`${clientDir}${assetPath}`, 'globalThis.ok = true;');
await Bun.write(`${root}/outside-secret.txt`, secretBody);
await Bun.write(`${root}/outside/secret.txt`, secretBody);
await symlink(`${root}/outside-secret.txt`, `${clientDir}/linked-file.txt`);
await symlink(`${root}/outside`, `${clientDir}/linked-dir`);

const handler = await createFetchHandler(
  clientDir,
  (request) => new Response(`${ssrMarker} ${new URL(request.url).pathname}`),
);

const get = (path: string) => handler(new Request(`http://127.0.0.1${path}`));

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('createFetchHandler', () => {
  it('serves a built asset with the immutable cache header', async () => {
    const response = await get(assetPath);

    expect(response.status).toBe(okStatus);
    expect(await response.text()).toBe('globalThis.ok = true;');
    expect(response.headers.get('cache-control')).toBe(immutableCache);
  });

  it('serves a non-asset static file without the immutable cache header', async () => {
    const response = await get('/favicon.svg');

    expect(response.status).toBe(okStatus);
    expect(await response.text()).toBe('<svg />');
    expect(response.headers.get('cache-control')).toBeNull();
  });

  /**
   * Handler-level behavior only. On the wire these paths reach the handler
   * unchanged (serve-boot.test.ts pins that), and the shipped SSR bundle
   * answers the undecodable ones with its own 400 — which is why this file
   * asserts the fallthrough rather than a status the real app would return.
   */
  it.each(['/a%2Fb', '/foo%00', '/%zz', '/%'])(
    'hands the malformed path %s to the SSR handler',
    async (path) => {
      const response = await get(path);

      expect(response.status).toBe(okStatus);
      expect(await response.text()).toContain(ssrMarker);
    },
  );

  it.each([
    '/../outside-secret.txt',
    '/%2e%2e/outside-secret.txt',
    '/%2e%2e%2foutside-secret.txt',
    '/%252e%252e/outside-secret.txt',
    '/..%2f..%2foutside-secret.txt',
    // Containment is resolved, not lexical: a link stored inside the client
    // directory stays inside it or is not served.
    '/linked-file.txt',
    '/linked-dir/secret.txt',
  ])('cannot escape the client directory through %s', async (path) => {
    const response = await get(path);
    const body = await response.text();

    expect(body).not.toContain(secretBody);
    expect(body).toContain(ssrMarker);
  });

  it.each(['/', '/login', '/index.html/nested'])(
    'falls through to the SSR handler for %s',
    async (path) => {
      const response = await get(path);

      expect(await response.text()).toContain(ssrMarker);
    },
  );
});
