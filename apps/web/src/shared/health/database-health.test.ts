import { afterEach, describe, expect, it } from 'bun:test';
import { pgClientLayer } from '@postlude/db/connections';
import { listen, type TCPSocketListener } from 'bun';
import { Effect } from 'effect';

import {
  databaseHealthDeadlineMs,
  makeDatabaseCheck,
} from './database-health.ts';

const listeners = new Set<TCPSocketListener>();

// A server that accepts every connection and never answers.
const listenSilently = (onConnect: () => void): number => {
  const listener = listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { open: onConnect, data: () => undefined },
  });
  listeners.add(listener);
  return listener.port;
};

afterEach(() => {
  for (const listener of listeners) {
    listener.stop(true);
  }
  listeners.clear();
});

const urlFor = (port: number) =>
  `postgresql://app:app@127.0.0.1:${port}/app?sslmode=disable`;

const checkAgainst = (url: string, runs: { count: number } = { count: 0 }) =>
  makeDatabaseCheck((check) => {
    runs.count += 1;
    return Effect.runPromise(check.pipe(Effect.provide(pgClientLayer(url))));
  });

describe('database health check', () => {
  it('reports unavailable at the deadline when the database accepts a connection and never answers', async () => {
    let connections = 0;
    const port = listenSilently(() => {
      connections += 1;
    });
    const runs = { count: 0 };
    const check = checkAgainst(urlFor(port), runs);
    const startedAt = performance.now();

    const answers = await Promise.all([check(), check(), check()]);
    const elapsed = performance.now() - startedAt;

    expect(answers).toEqual([false, false, false]);
    expect(elapsed).toBeGreaterThanOrEqual(databaseHealthDeadlineMs - 100);
    expect(elapsed).toBeLessThan(databaseHealthDeadlineMs + 500);
    expect(runs.count).toBe(1);
    expect(connections).toBe(1);
  });

  it('reports unavailable at once when nothing listens', async () => {
    const listener = listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: { data: () => undefined },
    });
    const { port } = listener;
    listener.stop(true);

    expect(await checkAgainst(urlFor(port))()).toBe(false);
  });

  it('checks again after a failed check instead of remembering the failure', async () => {
    const runs = { count: 0 };
    const port = listenSilently(() => undefined);
    const check = checkAgainst(urlFor(port), runs);

    await check();
    await check();

    expect(runs.count).toBe(2);
  });

  it('reports unavailable when the run itself fails', async () => {
    const check = makeDatabaseCheck(() =>
      Promise.reject(new Error('client could not be built')),
    );

    expect(await check()).toBe(false);
  });
});
