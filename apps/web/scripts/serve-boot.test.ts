import { afterAll, describe, expect, it } from 'bun:test';
import { mkdir, rm, symlink } from 'node:fs/promises';

const okStatus = 200;
const serverErrorStatus = 500;
const successExit = 0;
/** Bun's development-mode debug page is ~67 KB; a plain 500 is a few dozen bytes. */
const debugPageFloor = 1024;

const ssrMarker = 'ssr-handled';
const secretBody = 'outside-the-client-directory';

const root = `${Bun.env.TMPDIR ?? '/tmp'}/postlude-boot-${crypto.randomUUID()}`;
const scriptsDir = new URL('.', import.meta.url);
const workspaceModules = Bun.fileURLToPath(
  new URL('../node_modules', scriptsDir),
);

const healthyBundle = `
export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/healthz') return Response.json({ status: 'ok' });
    if (pathname === '/boom') throw new Error('ssr entry blew up');
    return new Response(${JSON.stringify(ssrMarker)} + ' ' + pathname);
  },
};
`;

const bundleAnswering = (statement: string) =>
  `export default { fetch() { ${statement} } };`;

/** What a misconfigured deployment did before the boot self-check existed. */
const emptyAnswerBundle = bundleAnswering(
  'return new Response(null, { status: 204 });',
);
const throwingBundle = bundleAnswering(
  "throw new Error('Invalid environment variables');",
);

/**
 * serve.ts resolves dist relative to its own file, so booting it against a
 * fixture dist means running its source from a sandbox that has one. The
 * scripts are copied at test time: an edit to serve.ts changes what every test
 * below runs.
 */
const createSandbox = async (ssrBundle: string | null): Promise<string> => {
  const dir = `${root}/${crypto.randomUUID()}`;
  await Promise.all(
    ['serve.ts', 'server-config.ts'].map((script) =>
      Bun.write(
        `${dir}/scripts/${script}`,
        Bun.file(new URL(script, scriptsDir)),
      ),
    ),
  );
  if (ssrBundle !== null) {
    await Bun.write(`${dir}/dist/server/server.js`, ssrBundle);
  }
  await mkdir(`${dir}/dist/client`, { recursive: true });
  // zod, imported by server-config.ts, resolves from the copied script's path.
  await symlink(workspaceModules, `${dir}/node_modules`);
  return dir;
};

/** A port nothing is listening on, so a boot that should fail cannot fail on the bind. */
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

const readStartupLine = async (
  child: ReturnType<typeof spawnServer>,
): Promise<string> => {
  const reader = child.stdout.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  if (value === undefined) {
    const stderr = await new Response(child.stderr).text();
    throw new Error(`the sandbox server exited during boot: ${stderr}`);
  }
  return new TextDecoder().decode(value).trim();
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

const port = await freePort();
const sandbox = await createSandbox(healthyBundle);
const server = spawnServer(sandbox, port);
const origin = `http://127.0.0.1:${port}`;
// Blocks until the server reports the address it listens on.
await readStartupLine(server);

afterAll(async () => {
  server.kill();
  await server.exited;
  await rm(root, { recursive: true, force: true });
});

describe('the production server', () => {
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

  it('does not follow a symlink that leaves the client directory', async () => {
    await Bun.write(`${root}/spawned-outside.txt`, secretBody);
    await symlink(
      `${root}/spawned-outside.txt`,
      `${sandbox}/dist/client/escape.txt`,
    );

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
