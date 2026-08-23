import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { createFetchHandler } from './serve.ts';

const okStatus = 200;
const serverErrorStatus = 500;
const debugPageFloor = 1024;

const ssrMarker = 'ssr-handled';
const assetPath = '/assets/app-abcd1234.js';
const immutableCache = 'public, max-age=31536000, immutable';
const secretBody = 'outside-the-client-directory';

const root = `${Bun.env.TMPDIR ?? '/tmp'}/postlude-serve-${crypto.randomUUID()}`;
const clientDir = `${root}/client`;

const handler = createFetchHandler(
  clientDir,
  (request) => new Response(`${ssrMarker} ${new URL(request.url).pathname}`),
);

const get = (path: string) => handler(new Request(`http://127.0.0.1${path}`));

beforeAll(async () => {
  await Bun.write(`${clientDir}/index.html`, '<!doctype html>index');
  await Bun.write(`${clientDir}/favicon.svg`, '<svg />');
  await Bun.write(`${clientDir}${assetPath}`, 'globalThis.ok = true;');
  await Bun.write(`${root}/outside-secret.txt`, secretBody);
});

afterAll(async () => {
  await Bun.$`rm -rf ${root}`.quiet();
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

  it.each(['/a%2Fb', '/foo%00', '/%zz', '/%'])(
    'falls through to the SSR handler for the malformed path %s',
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

/**
 * The failing handler has to run in its own process: `bun test` attributes an
 * error thrown inside a fetch handler to the surrounding test and fails it.
 */
const bootFailingServer = async () => {
  const source = [
    `import { createFetchHandler } from ${JSON.stringify(new URL('./serve.ts', import.meta.url).href)};`,
    'const server = Bun.serve({',
    '  port: 0,',
    '  development: false,',
    `  fetch: createFetchHandler(${JSON.stringify(clientDir)}, () => {`,
    "    throw new Error('ssr entry blew up');",
    '  }),',
    '});',
    'console.log(server.url.href);',
  ].join('\n');
  const child = Bun.spawn(['bun', '-e', source], {
    stdout: 'pipe',
    stderr: 'ignore',
  });
  const reader = child.stdout.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  return { child, url: new TextDecoder().decode(value).trim() };
};

describe('the production server', () => {
  it('answers a thrown SSR error without leaking source or paths', async () => {
    const { child, url } = await bootFailingServer();

    try {
      const response = await fetch(new URL('/boom', url));
      const body = await response.text();

      expect(response.status).toBe(serverErrorStatus);
      expect(body.length).toBeLessThan(debugPageFloor);
      expect(body).not.toContain('createFetchHandler');
      expect(body).not.toContain(clientDir);
    } finally {
      child.kill();
      await child.exited;
    }
  });
});
