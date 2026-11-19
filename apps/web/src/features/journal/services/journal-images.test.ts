import { expect, it, spyOn } from 'bun:test';
import { env, listen, serve, sleep } from 'bun';
import { Effect } from 'effect';
import { imageRoute, maximumImageBytes } from '../images.ts';
import { type ImageStorage, makeJournalImages } from './journal-images.ts';

const bucket = 'journal-images';
const credentials = { accessKeyId: 'test-key', secretAccessKey: 'test-secret' };
const gif = new TextEncoder().encode('GIF89a synthetic image');
const proxyVariables = [
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
];

type Variables = ReadonlyArray<readonly [string, string | undefined]>;

/** Runs `body` with these environment variables set or unset, then restores them. */
const withEnv = async <A>(variables: Variables, body: () => Promise<A>) => {
  const before: Variables = variables.map(([name]) => [name, env[name]]);
  const assign = (values: Variables) => {
    for (const [name, value] of values) {
      if (value === undefined) {
        delete env[name];
      } else {
        env[name] = value;
      }
    }
  };
  assign(variables);
  try {
    return await body();
  } finally {
    assign(before);
  }
};

const withoutProxy = <A>(body: () => Promise<A>) =>
  withEnv(
    proxyVariables.map((name) => [name, undefined]),
    body,
  );

type Stored = {
  readonly path: string;
  readonly contentLength: string | null;
  readonly transferEncoding: string | null;
  readonly bytes: Uint8Array;
};

/** An S3 store on loopback that keeps objects in memory. */
const fakeStore = (objects = new Map<string, Uint8Array<ArrayBuffer>>()) => {
  const puts: Array<Stored> = [];
  const server = serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      if (request.method === 'PUT') {
        const bytes = new Uint8Array(await request.arrayBuffer());
        puts.push({
          path,
          contentLength: request.headers.get('content-length'),
          transferEncoding: request.headers.get('transfer-encoding'),
          bytes,
        });
        objects.set(path, bytes);
        return new Response(null, { headers: { etag: '"synthetic"' } });
      }
      const object = objects.get(path);
      return object === undefined
        ? new Response('<Error><Code>NoSuchKey</Code></Error>', {
            status: 404,
          })
        : new Response(object, {
            headers: { 'content-type': 'application/octet-stream' },
          });
    },
  });
  const storage: ImageStorage = {
    endpoint: `http://127.0.0.1:${server.port}`,
    bucket,
    ...credentials,
    requestTimeout: 5000,
  };
  return { server, storage, puts, objects };
};

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.result));

const keyOf = (src: string) => src.slice(imageRoute.length);
const pngKey = () => `${crypto.randomUUID()}.png`;

it('stores an image with its length and reads the same bytes back', async () => {
  const store = fakeStore();
  try {
    await withoutProxy(async () => {
      const images = makeJournalImages(() => Promise.resolve(store.storage));
      const uploaded = await Effect.runPromise(images.upload(gif));
      const key = keyOf(uploaded.src);

      expect(store.puts).toEqual([
        {
          path: `/${bucket}/${key}`,
          contentLength: String(gif.byteLength),
          transferEncoding: null,
          bytes: gif,
        },
      ]);
      expect(await Effect.runPromise(images.read(key))).toEqual(gif);
    });
  } finally {
    store.server.stop(true);
  }
});

it('reads an image of the largest allowed size in full', async () => {
  const largest = new Uint8Array(maximumImageBytes).map(
    (_, index) => index % 251,
  );
  const key = pngKey();
  const store = fakeStore(new Map([[`/${bucket}/${key}`, largest]]));
  try {
    await withoutProxy(async () => {
      const images = makeJournalImages(() => Promise.resolve(store.storage));
      expect(await Effect.runPromise(images.read(key))).toEqual(largest);
    });
  } finally {
    store.server.stop(true);
  }
});

it('refuses a stored image larger than the limit', async () => {
  const key = pngKey();
  const store = fakeStore(
    new Map([[`/${bucket}/${key}`, new Uint8Array(maximumImageBytes + 1)]]),
  );
  try {
    await withoutProxy(async () => {
      const images = makeJournalImages(() => Promise.resolve(store.storage));
      expect(await run(images.read(key))).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'JournalImageError',
          message: 'The stored image is missing or too large to read.',
        },
      });
    });
  } finally {
    store.server.stop(true);
  }
});

/**
 * A store on loopback that answers each request with `reply`, or never when it is
 * absent, and counts the connections it sees open and close.
 */
const rawStore = (reply?: string) => {
  const connections = { opened: 0, closed: 0 };
  const server = listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open: () => {
        connections.opened += 1;
      },
      close: () => {
        connections.closed += 1;
      },
      data: (socket, data) => {
        if (reply !== undefined && data.toString().includes('\r\n\r\n')) {
          socket.write(reply);
        }
      },
    },
  });
  const storage = (requestTimeout: number): ImageStorage => ({
    endpoint: `http://127.0.0.1:${server.port}`,
    bucket,
    ...credentials,
    requestTimeout,
  });
  return { server, storage, connections };
};

type Connections = { readonly opened: number; readonly closed: number };

/** Waits up to a second for every connection that opened to close. */
const allClosed = async (
  connections: Connections,
  deadline = performance.now() + 1000,
): Promise<Connections> => {
  if (
    connections.closed >= connections.opened ||
    performance.now() >= deadline
  ) {
    return connections;
  }
  await sleep(10);
  return allClosed(connections, deadline);
};

it('fails a request the store leaves unanswered once the timeout passes', async () => {
  const store = rawStore();
  try {
    await withoutProxy(async () => {
      const images = makeJournalImages(() =>
        Promise.resolve(store.storage(200)),
      );
      const started = performance.now();
      const result = await run(images.read(pngKey()));

      expect(result).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'JournalImageError',
          cause: { name: 'TimeoutError' },
        },
      });
      // Two attempts of 200 ms each plus the SDK's retry delay.
      expect(performance.now() - started).toBeLessThan(3000);
      // Both attempts' connections close once the read has failed.
      expect(await allClosed(store.connections)).toEqual({
        opened: 2,
        closed: 2,
      });
    });
  } finally {
    store.server.stop(true);
  }
});

it('closes the connection of a stored image it refuses as too large', async () => {
  // The headers announce one byte over the limit and the body never finishes.
  const store = rawStore(
    `HTTP/1.1 200 OK\r\ncontent-length: ${maximumImageBytes + 1}\r\ncontent-type: image/png\r\n\r\nGIF89a`,
  );
  // Recording every response keeps it reachable, as it would be until the next
  // garbage collection, which would otherwise close a dropped one's connection.
  const fetches = spyOn(globalThis, 'fetch');
  try {
    await withoutProxy(async () => {
      const images = makeJournalImages(() =>
        Promise.resolve(store.storage(5000)),
      );
      expect(await run(images.read(pngKey()))).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'JournalImageError',
          message: 'The stored image is missing or too large to read.',
        },
      });
      expect(await allClosed(store.connections)).toEqual({
        opened: 1,
        closed: 1,
      });
    });
  } finally {
    fetches.mockRestore();
    store.server.stop(true);
  }
});

it('opens its connection to the store through the HTTPS_PROXY tunnel', async () => {
  const account = '0123456789abcdef0123456789abcdef';
  const requests: Array<string> = [];
  const proxy = listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      data: (socket, data) => {
        requests.push(data.toString().split('\r\n')[0] ?? '');
        // Refusing the tunnel keeps the test off the internet.
        socket.end('HTTP/1.1 403 Forbidden\r\ncontent-length: 0\r\n\r\n');
      },
    },
  });
  try {
    await withEnv(
      [
        ['HTTPS_PROXY', `http://127.0.0.1:${proxy.port}`],
        ['https_proxy', undefined],
        ['NO_PROXY', undefined],
        ['no_proxy', undefined],
      ],
      async () => {
        const images = makeJournalImages(() =>
          Promise.resolve({
            endpoint: `https://${account}.eu.r2.cloudflarestorage.com`,
            bucket,
            ...credentials,
            requestTimeout: 5000,
          }),
        );
        expect(await run(images.upload(gif))).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'JournalImageError' },
        });
      },
    );
    expect(requests.length).toBeGreaterThan(0);
    expect(new Set(requests)).toEqual(
      new Set([
        `CONNECT ${bucket}.${account}.eu.r2.cloudflarestorage.com:443 HTTP/1.1`,
      ]),
    );
  } finally {
    proxy.stop(true);
  }
});
