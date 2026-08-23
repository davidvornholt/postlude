/**
 * Production server: serves the static client assets from dist/client and
 * hands everything else to the TanStack Start SSR handler. The server entry
 * produced by `vite build` (dist/server/server.js) only exports a fetch
 * handler and does not serve static files itself.
 */

import { parsePort } from './server-config.ts';

type StartServerEntry = {
  readonly default: {
    readonly fetch: (request: Request) => Promise<Response> | Response;
  };
};

const serverEntryUrl = new URL('../dist/server/server.js', import.meta.url);
const clientDirUrl = new URL('../dist/client/', import.meta.url);
const port = parsePort(Bun.env.PORT);

const { default: startServer } = (await import(
  serverEntryUrl.href
)) as StartServerEntry;

const immutableCache = 'public, max-age=31536000, immutable';

const serveStatic = async (pathname: string): Promise<Response | null> => {
  // No path escape out of dist/client; assets have plain paths.
  if (pathname.includes('..') || pathname === '/') {
    return null;
  }
  const file = Bun.file(new URL(`.${pathname}`, clientDirUrl));
  if (!(await file.exists())) {
    return null;
  }
  const headers = pathname.startsWith('/assets/')
    ? { 'cache-control': immutableCache }
    : undefined;
  return new Response(file, { headers });
};

const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  fetch: async (request) => {
    const { pathname } = new URL(request.url);
    const staticResponse = await serveStatic(pathname);
    return staticResponse ?? startServer.fetch(request);
  },
});

await Bun.write(Bun.stdout, `Postlude is running at ${server.url}\n`);
