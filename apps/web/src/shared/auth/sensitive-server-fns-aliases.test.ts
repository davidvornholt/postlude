import { describe, expect, it } from 'bun:test';
import { Transpiler } from 'bun';

import {
  type Module,
  type Surface,
  scanModules,
} from './sensitive-server-fns-scan.ts';

const transpiler = new Transpiler({ loader: 'ts' });
const moduleOf = (path: string, source: string): Module => ({
  path,
  code: transpiler.transformSync(source),
});
const surfaceShape = ({ path, name, guarded }: Surface) => ({
  path,
  name,
  guarded,
});

const factoryModules = [
  moduleOf(
    'shared/server-factory.ts',
    "export { createServerFn as makeServerFn } from '@tanstack/react-start';",
  ),
  moduleOf(
    'shared/server-factory-next.ts',
    "export { makeServerFn as buildServerFn } from './server-factory.ts';",
  ),
  moduleOf(
    'shared/route-factory.ts',
    "export { createFileRoute as makeRoute } from '@tanstack/react-router';",
  ),
  moduleOf(
    'shared/route-factory-next.ts',
    "export { makeRoute as buildRoute } from './route-factory.ts';",
  ),
];

describe('renamed server factory scanning', () => {
  it('finds guarded and unguarded server functions through renamed re-exports', () => {
    const scan = scanModules([
      ...factoryModules,
      moduleOf(
        'journal/guarded.ts',
        `import { buildServerFn as serverFn } from '#/shared/server-factory-next.ts';
import { sessionRequired as requireSession } from '#/shared/auth/auth-middleware.ts';
export const guardedFn = serverFn({ method: 'GET' }).middleware([requireSession]).handler(() => 'secret');`,
      ),
      moduleOf(
        'journal/unguarded.ts',
        `import { buildServerFn as serverFn } from '#/shared/server-factory-next.ts';
export const unguardedFn = serverFn({ method: 'GET' }).handler(() => 'secret');`,
      ),
    ]);

    expect(scan.serverFunctions.map(surfaceShape)).toEqual([
      { path: 'journal/guarded.ts', name: 'guardedFn', guarded: true },
      { path: 'journal/unguarded.ts', name: 'unguardedFn', guarded: false },
    ]);
  });

  it('uses effective final route properties after renamed re-exports', () => {
    const guarded =
      '{ middleware: [requireSession], handlers: { POST: () => Response.json({ ok: true }) } }';
    const unguarded =
      '{ handlers: { POST: () => Response.json({ ok: true }) } }';
    const route = (path: string, options: string) =>
      moduleOf(
        path,
        `import { buildRoute as routeFactory } from '#/shared/route-factory-next.ts';
import { sessionRequired as requireSession } from '#/shared/auth/auth-middleware.ts';
export const Route = routeFactory('/fixture')(${options});`,
      );
    const scan = scanModules([
      ...factoryModules,
      route(
        'routes/final-unguarded.ts',
        `{ server: ${guarded}, ...{ server: ${unguarded} } }`,
      ),
      route(
        'routes/final-guarded.ts',
        `{ ...{ server: ${unguarded} }, server: ${guarded} }`,
      ),
    ]);

    expect(scan.routeHandlers.map(surfaceShape)).toEqual([
      { path: 'routes/final-guarded.ts', name: 'POST', guarded: true },
      { path: 'routes/final-unguarded.ts', name: 'POST', guarded: false },
    ]);
  });

  it('fails closed when a renamed local re-export cannot be resolved', () => {
    const scan = scanModules([
      moduleOf(
        'shared/unresolved-server.ts',
        "export { missingServer as buildServer } from './missing-server.ts';",
      ),
      moduleOf(
        'shared/unresolved-route.ts',
        "export { missingRoute as buildRoute } from './missing-route.ts';",
      ),
      moduleOf(
        'journal/unresolved.ts',
        `import { buildServer as serverFactory } from '#/shared/unresolved-server.ts';
export const unresolvedFn = serverFactory({ method: 'GET' }).handler(() => 'secret');`,
      ),
      moduleOf(
        'routes/unresolved.ts',
        `import { buildRoute as routeFactory } from '#/shared/unresolved-route.ts';
export const Route = routeFactory('/fixture')({ server: { handlers: { POST: () => Response.json({ secret: true }) } } });`,
      ),
    ]);

    expect(scan.serverFunctions.map(surfaceShape)).toEqual([
      {
        path: 'journal/unresolved.ts',
        name: 'unresolvedFn',
        guarded: false,
      },
      { path: 'routes/unresolved.ts', name: 'Route', guarded: false },
    ]);
    expect(scan.routeHandlers.map(surfaceShape)).toEqual([
      {
        path: 'journal/unresolved.ts',
        name: '(unreadable handlers)',
        guarded: false,
      },
      { path: 'routes/unresolved.ts', name: 'POST', guarded: false },
    ]);
  });
});
