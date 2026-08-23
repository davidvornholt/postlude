/**
 * Production server: serves the static client assets from dist/client and
 * hands everything else to the TanStack Start SSR handler. The server entry
 * produced by `vite build` (dist/server/server.js) only exports a fetch
 * handler and does not serve static files itself.
 */

import { parsePort } from './server-config.ts';

type FetchHandler = (request: Request) => Promise<Response> | Response;

type StartServerEntry = {
  readonly default: {
    readonly fetch: FetchHandler;
  };
};

const immutableCache = 'public, max-age=31536000, immutable';

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

export const createFetchHandler = (
  clientDir: string,
  ssrFetch: FetchHandler,
): FetchHandler => {
  const clientDirUrl = Bun.pathToFileURL(
    clientDir.endsWith('/') ? clientDir : `${clientDir}/`,
  );
  const clientDirPath = Bun.fileURLToPath(clientDirUrl);

  const serveStatic = async (pathname: string): Promise<Response | null> => {
    const file = openClientFile(pathname, clientDirUrl);
    // Containment: a decoded path can resolve above the client directory, and
    // only what stays inside it is ours to serve.
    if (file?.name?.startsWith(clientDirPath) !== true) {
      return null;
    }
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

// Only the script entry point boots a server; tests import the factory above.
if (import.meta.main) {
  const serverEntryUrl = new URL('../dist/server/server.js', import.meta.url);
  const clientDir = Bun.fileURLToPath(
    new URL('../dist/client/', import.meta.url),
  );
  const { default: startServer } = (await import(
    serverEntryUrl.href
  )) as StartServerEntry;

  const server = Bun.serve({
    port: parsePort(Bun.env.PORT),
    hostname: '0.0.0.0',
    // Bun's development mode answers an unhandled error with a debug page
    // carrying this script's source and absolute paths.
    development: false,
    fetch: createFetchHandler(clientDir, (request) =>
      startServer.fetch(request),
    ),
  });

  await Bun.write(Bun.stdout, `Postlude is running at ${server.url}\n`);
}
