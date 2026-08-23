/**
 * Production server: serves the static client assets from dist/client and
 * hands everything else to the TanStack Start SSR handler. The server entry
 * produced by `vite build` (dist/server/server.js) only exports a fetch
 * handler and does not serve static files itself.
 */

import { realpath } from 'node:fs/promises';
import process from 'node:process';

import { parsePort } from './server-config.ts';

type FetchHandler = (request: Request) => Promise<Response> | Response;

type StartServerEntry = {
  readonly default: {
    readonly fetch: FetchHandler;
  };
};

const immutableCache = 'public, max-age=31536000, immutable';
const okStatus = 200;
const healthPath = '/api/healthz';

const openClientFile = (pathname: string, clientDirUrl: URL) => {
  try {
    // Decode first so encoded separators and dot segments are resolved by the
    // URL parser instead of reaching Bun.file, which rejects them with a
    // TypeError that would otherwise surface as a 500.
    return Bun.file(new URL(`.${decodeURIComponent(pathname)}`, clientDirUrl));
  } catch {
    // Invalid percent escapes never name a built asset.
    return null;
  }
};

const resolveRealPath = async (path: string): Promise<string | null> => {
  try {
    return await realpath(path);
  } catch {
    // Missing files, broken links, and symlink loops are all "not ours to
    // serve"; the request falls through to SSR.
    return null;
  }
};

export const createFetchHandler = async (
  clientDir: string,
  ssrFetch: FetchHandler,
): Promise<FetchHandler> => {
  const clientDirUrl = Bun.pathToFileURL(
    clientDir.endsWith('/') ? clientDir : `${clientDir}/`,
  );
  // Resolved once at startup so a deployment that reaches dist/client through
  // a symlinked release directory still compares like for like below.
  const clientRoot = `${await realpath(Bun.fileURLToPath(clientDirUrl))}/`;

  const serveStatic = async (pathname: string): Promise<Response | null> => {
    const candidate = openClientFile(pathname, clientDirUrl)?.name;
    const resolved =
      candidate === undefined ? null : await resolveRealPath(candidate);
    // Containment: both a decoded path and a symlink stored inside the client
    // directory can point above it, and only what really resolves inside it is
    // ours to serve.
    if (resolved?.startsWith(clientRoot) !== true) {
      return null;
    }
    const file = Bun.file(resolved);
    if (!(await file.exists())) {
      return null;
    }
    const headers = pathname.startsWith('/assets/')
      ? { 'cache-control': immutableCache }
      : undefined;
    return new Response(file, { headers });
  };

  return async (request) => {
    const { pathname } = new URL(request.url);
    return (await serveStatic(pathname)) ?? ssrFetch(request);
  };
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const abortBoot = async (reason: string): Promise<never> => {
  await Bun.write(Bun.stderr, `Postlude cannot start: ${reason}\n`);
  return process.exit(1);
};

const parseBootPort = async (value: string | undefined): Promise<number> => {
  try {
    return parsePort(value);
  } catch (error) {
    return await abortBoot(describeError(error));
  }
};

const loadSsrFetch = async (entryUrl: URL): Promise<FetchHandler> => {
  try {
    const { default: startServer } = (await import(
      entryUrl.href
    )) as StartServerEntry;
    return (request) => startServer.fetch(request);
  } catch (error) {
    return abortBoot(
      `loading the SSR bundle ${entryUrl.pathname} failed: ${describeError(error)}. Either it has not been built (\`bun run build\`) or an environment value it validates as it loads is missing or malformed (see apps/web/README.md).`,
    );
  }
};

/**
 * One in-process request through the composed handler, before the port is
 * bound. The liveness route touches neither database nor OAuth, so anything
 * other than 200 means the process cannot serve requests at all — and a
 * process that stays up in that state answers health checks with a lie.
 */
const bootSelfCheckFailure = async (
  handler: FetchHandler,
  port: number,
): Promise<string | null> => {
  try {
    const response = await handler(
      new Request(`http://127.0.0.1:${port}${healthPath}`),
    );
    return response.status === okStatus
      ? null
      : `answered ${response.status} instead of ${okStatus}`;
  } catch (error) {
    return `threw: ${describeError(error)}`;
  }
};

// Only the script entry point boots a server; tests import the factory above.
if (import.meta.main) {
  // Cheapest precondition first: an unusable PORT must not cost an SSR bundle
  // load before it is reported.
  const port = await parseBootPort(Bun.env.PORT);
  const clientDir = Bun.fileURLToPath(
    new URL('../dist/client/', import.meta.url),
  );
  const ssrFetch = await loadSsrFetch(
    new URL('../dist/server/server.js', import.meta.url),
  );
  const handler = await createFetchHandler(clientDir, ssrFetch).catch(
    (error: unknown) =>
      abortBoot(
        `the client asset directory ${clientDir} is unreadable. Run \`bun run build\` first. ${describeError(error)}`,
      ),
  );

  const selfCheckFailure = await bootSelfCheckFailure(handler, port);
  if (selfCheckFailure !== null) {
    await abortBoot(
      `the boot self-check request to ${healthPath} ${selfCheckFailure}. Check the environment values documented in apps/web/README.md.`,
    );
  }

  const server = Bun.serve({
    port,
    hostname: '0.0.0.0',
    // Bun's development mode answers an unhandled error with a debug page
    // carrying this script's source and absolute paths.
    development: false,
    fetch: handler,
  });

  await Bun.write(Bun.stdout, `Postlude is running at ${server.url}\n`);
}
