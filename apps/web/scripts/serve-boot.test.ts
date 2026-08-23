import { afterAll, describe, expect, it } from 'bun:test';
import { rm, symlink } from 'node:fs/promises';

import {
  createSandbox,
  emptyAnswerBundle,
  healthyBundle,
  root,
  ssrMarker,
  throwingBundle,
} from './serve-boot-test-support.ts';

const okStatus = 200;
const serverErrorStatus = 500;
const successExit = 0;
/** Bun's development-mode debug page is ~67 KB; a plain 500 is a few dozen bytes. */
const debugPageFloor = 1024;

const bindAttempts = 4;
const secretBody = 'outside-the-client-directory';
const builtAsset = 'globalThis.built = true;';

/**
 * A port that was free a moment ago. The boots that abort never reach the bind,
 * so a lost port cannot change their outcome; the boot that serves retries.
 */
const freePort = async (): Promise<string> => {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const { port } = probe.url;
  await probe.stop(true);
  return port;
};

// The dotenv wire name the server reads, not an identifier this file chooses.
const portVariable = 'PORT';
// Bun.env's type carries Vite's boolean DEV/PROD/SSR flags; a child env is strings.
const parentEnv = Bun.env as Record<string, string | undefined>;

const spawnServer = (dir: string, portValue: string) =>
  Bun.spawn(['bun', `${dir}/scripts/serve.ts`], {
    cwd: dir,
    env: { ...parentEnv, [portVariable]: portValue },
    stdout: 'pipe',
    stderr: 'pipe',
  });

type SandboxServer = ReturnType<typeof spawnServer>;

/** The line the server prints once it listens, or null if it died first. */
const readStartup = async (child: SandboxServer): Promise<string | null> => {
  const reader = child.stdout.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  return value === undefined ? null : new TextDecoder().decode(value).trim();
};

/**
 * Another process can take the probed port before the child binds it, so a
 * boot that dies that way is retried on a fresh one. Reaching the startup line
 * is what proves this child owns the port the tests below talk to.
 */
const startServing = async (
  dir: string,
  attemptsLeft: number,
): Promise<{ readonly child: SandboxServer; readonly origin: string }> => {
  const port = await freePort();
  const child = spawnServer(dir, port);
  if ((await readStartup(child)) !== null) {
    return { child, origin: `http://127.0.0.1:${port}` };
  }
  const failure = await new Response(child.stderr).text();
  if (attemptsLeft > 1 && failure.includes('EADDRINUSE')) {
    return startServing(dir, attemptsLeft - 1);
  }
  throw new Error(`the sandbox server exited during boot: ${failure}`);
};

const bootFailure = async (ssrBundle: string | null, portValue: string) => {
  const dir = await createSandbox(ssrBundle);
  const child = spawnServer(dir, portValue);
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stderr };
};

const sandbox = await createSandbox(healthyBundle);
// The release layout a deployment actually has: dist/client is a link, and the
// built files live outside dist. The server resolves that link once at startup,
// which is the only reason anything under it is inside the root it compares
// against.
const releaseClient = `${root}/release-client`;
await rm(`${sandbox}/dist/client`, { recursive: true });
await Bun.write(`${releaseClient}/assets/app.js`, builtAsset);
await symlink(releaseClient, `${sandbox}/dist/client`);

// Blocks until the server reports that it listens.
const { child: server, origin } = await startServing(sandbox, bindAttempts);

afterAll(async () => {
  server.kill();
  await server.exited;
  await rm(root, { recursive: true, force: true });
});

describe('the production server', () => {
  it('serves a built asset through the dist/client link', async () => {
    const response = await fetch(`${origin}/assets/app.js`);

    expect(response.status).toBe(okStatus);
    expect(await response.text()).toBe(builtAsset);
  });

  it('answers a thrown SSR error without leaking source or paths', async () => {
    const response = await fetch(`${origin}/boom`);
    const body = await response.text();

    expect(response.status).toBe(serverErrorStatus);
    // The debug page carries the source and absolute paths base64-encoded in a
    // <script id="__bunfallback"> payload, so its size, its content type, and
    // that marker are what catch it — plaintext assertions never would.
    expect(response.headers.get('content-type') ?? '').toContain('text/plain');
    expect(body.length).toBeLessThan(debugPageFloor);
    expect(body).not.toContain('__bunfallback');
    expect(body).not.toContain(sandbox);
  });

  it.each(['/a%2Fb', '/foo%00', '/%zz', '/%'])(
    'delivers the malformed path %s to the handler rather than rejecting it',
    async (path) => {
      const response = await fetch(`${origin}${path}`);

      expect(response.status).toBe(okStatus);
      expect(await response.text()).toContain(ssrMarker);
    },
  );

  it('does not follow a symlink out of the resolved client directory', async () => {
    await Bun.write(`${root}/spawned-outside.txt`, secretBody);
    await symlink(`${root}/spawned-outside.txt`, `${releaseClient}/escape.txt`);

    const response = await fetch(`${origin}/escape.txt`);
    const body = await response.text();

    expect(body).not.toContain(secretBody);
    expect(body).toContain(ssrMarker);
  });
});

describe('booting', () => {
  it('refuses to listen when the liveness route degrades to an empty 204', async () => {
    const { exitCode, stderr } = await bootFailure(
      emptyAnswerBundle,
      await freePort(),
    );

    expect(exitCode).not.toBe(successExit);
    expect(stderr).toContain('/api/healthz');
    expect(stderr).toContain('answered 204');
  });

  it('refuses to listen when the SSR handler throws', async () => {
    const { exitCode, stderr } = await bootFailure(
      throwingBundle,
      await freePort(),
    );

    expect(exitCode).not.toBe(successExit);
    expect(stderr).toContain('Invalid environment variables');
  });

  it('refuses to listen without a built SSR bundle', async () => {
    const { exitCode, stderr } = await bootFailure(null, await freePort());

    expect(exitCode).not.toBe(successExit);
    expect(stderr).toContain('bun run build');
  });

  it('rejects an unusable PORT before it loads the SSR bundle', async () => {
    const { exitCode, stderr } = await bootFailure(throwingBundle, '0x1f5');

    expect(exitCode).not.toBe(successExit);
    expect(stderr).toContain('Invalid PORT');
    // The throwing bundle would have reported itself first if it had loaded.
    expect(stderr).not.toContain('Invalid environment variables');
  });
});
