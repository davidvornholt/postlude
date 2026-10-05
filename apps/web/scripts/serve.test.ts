import { afterAll, describe, expect, it } from 'bun:test';
import { rm, symlink } from 'node:fs/promises';

import { bootSelfCheckFailure, createFetchHandler, shutdown } from './serve.ts';

const unauthorizedStatus = 401;
const redirectStatus = 303;
const okStatus = 200;
const emptyStatus = 204;
const serverErrorStatus = 500;

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
  it('keeps final dynamic failures private while preserving their body, status and cookies', async () => {
    const privateHandler = await createFetchHandler(
      clientDir,
      () =>
        new Response('vetted serialized failure', {
          status: unauthorizedStatus,
          headers: [
            ['content-type', 'application/json'],
            ['x-tss-serialized', 'true'],
            ['set-cookie', 'first=fixture; HttpOnly'],
            ['set-cookie', 'second=fixture; HttpOnly'],
          ],
        }),
    );
    const response = await privateHandler(
      new Request('http://127.0.0.1/_serverFn/fixture'),
    );
    expect(response.status).toBe(unauthorizedStatus);
    expect(await response.text()).toBe('vetted serialized failure');
    expect(response.headers.get('cache-control')).toBe(
      'private, no-store, max-age=0',
    );
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-tss-serialized')).toBe('true');
    expect(response.headers.getSetCookie()).toEqual([
      'first=fixture; HttpOnly',
      'second=fixture; HttpOnly',
    ]);
  });

  it('can preserve an immutable redirect response as private', async () => {
    const redirectHandler = await createFetchHandler(clientDir, () =>
      Response.redirect('https://postlude.test/login', redirectStatus),
    );
    const response = await redirectHandler(
      new Request('http://127.0.0.1/archive'),
    );
    expect(response.status).toBe(redirectStatus);
    expect(response.headers.get('location')).toBe(
      'https://postlude.test/login',
    );
    expect(response.headers.get('cache-control')).toBe(
      'private, no-store, max-age=0',
    );
  });

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

const bootPort = 3000;
// Long enough that a settled handler always wins the race, short enough that
// the never-settling case costs the suite nothing.
const timeoutMs = 50;
const neverSettles = new Promise<Response>(() => undefined);

describe('bootSelfCheckFailure', () => {
  it('passes when both checked routes answer 200', async () => {
    const failure = await bootSelfCheckFailure(
      () => new Response('ok'),
      bootPort,
      timeoutMs,
    );

    expect(failure).toBeNull();
  });

  it('reports the liveness route and never reaches the page', async () => {
    const asked: Array<string> = [];
    const failure = await bootSelfCheckFailure(
      (request) => {
        asked.push(new URL(request.url).pathname);
        return new Response(null, { status: emptyStatus });
      },
      bootPort,
      timeoutMs,
    );

    expect(failure).toBe('/api/healthz answered 204 instead of 200');
    expect(asked).toEqual(['/api/healthz']);
  });

  it('reports the page when liveness answers but the page render fails', async () => {
    const failure = await bootSelfCheckFailure(
      (request) =>
        new URL(request.url).pathname === '/api/healthz'
          ? Response.json({ status: 'ok' })
          : new Response('render failed', { status: serverErrorStatus }),
      bootPort,
      timeoutMs,
    );

    expect(failure).toBe('/login answered 500 instead of 200');
  });

  it('reports a timeout instead of hanging when the handler never settles', async () => {
    const failure = await bootSelfCheckFailure(
      () => neverSettles,
      bootPort,
      timeoutMs,
    );

    expect(failure).toBe(`/api/healthz timed out after ${timeoutMs}ms`);
  });
});

describe('shutdown', () => {
  const serveUntil = (answer: Promise<void>) =>
    Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: async () => {
        await answer;
        return new Response('answered');
      },
    });

  it('closes the database only after the request in flight has answered', async () => {
    const events: Array<string> = [];
    const { promise: answer, resolve } = Promise.withResolvers<void>();
    const server = serveUntil(answer);
    const inFlight = fetch(server.url).then((response) => response.text());
    await Bun.sleep(50);

    const stopped = shutdown(
      server,
      () => {
        events.push('database closed');
        return Promise.resolve();
      },
      5000,
    );
    await Bun.sleep(50);
    events.push('answered');
    resolve();

    expect(await inFlight).toBe('answered');
    await stopped;
    expect(events).toEqual(['answered', 'database closed']);
  });

  it('cuts off a request that outlasts the drain and still closes the database', async () => {
    let closed = false;
    const server = serveUntil(new Promise<void>(() => undefined));
    const inFlight = fetch(server.url).then(
      () => 'answered',
      () => 'cut off',
    );
    await Bun.sleep(50);

    await shutdown(
      server,
      () => {
        closed = true;
        return Promise.resolve();
      },
      100,
    );

    expect(await inFlight).toBe('cut off');
    expect(closed).toBe(true);
  });
});
