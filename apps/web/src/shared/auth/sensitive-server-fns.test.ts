import { describe, expect, it } from 'bun:test';
import { file, Glob, Transpiler } from 'bun';

import {
  type Module,
  type Surface,
  scanModules,
} from './sensitive-server-fns-scan.ts';

/**
 * Enumerates the server surfaces under `apps/web/src` — server functions and
 * the request handlers a file route declares — and pins the ones reachable
 * without a session to an allowlist. The allowlist names each surface, not just
 * the file it sits in, so a second function added beside an exempt one is never
 * exempt by association.
 *
 * Three rules decide what the scan credits. A surface counts as guarded only
 * when `sessionRequired` comes from `shared/auth/auth-middleware.ts` itself and
 * is chained onto the very call that declares the surface. A declaration is any
 * local name standing for `createServerFn` or `createFileRoute`, from whichever
 * module it was imported, so a local re-export of the framework hides nothing.
 * A route serves requests unless it can be proven not to: everything under
 * `routes/api/` does, as does any route whose options so much as mention
 * `server` or `handlers`.
 *
 * The fixtures below are the shapes that used to slip past those rules.
 */

const sourceRoot = new URL('../../', import.meta.url);
const testFile = /\.test\.tsx?$/u;

const transpilers = {
  ts: new Transpiler({ loader: 'ts' }),
  tsx: new Transpiler({ loader: 'tsx' }),
};

const moduleOf = (path: string, source: string): Module => ({
  path,
  code: transpilers[path.endsWith('.tsx') ? 'tsx' : 'ts'].transformSync(source),
});

const reachableSignedOut = (surfaces: ReadonlyArray<Surface>) =>
  surfaces
    .filter(({ guarded }) => !guarded)
    .map(({ path, name }) => ({ path, name }));

/**
 * Server functions that must answer while signed out. `hasAuthorizedSessionFn`
 * is the signed-in check itself, so the login route calls it before any session
 * exists. Every other server function carries `sessionRequired`.
 */
const publicServerFunctions = [
  { path: 'shared/auth/session-fn.ts', name: 'hasAuthorizedSessionFn' },
];

/**
 * Journal functions covered by `sessionRequired`. That one middleware owns both
 * the session check and the private response policy, so this exact list also
 * prevents a journal function from returning cacheable private data.
 */
const privateServerFunctions = [
  {
    path: 'features/journal/services/archive-fns.ts',
    name: 'readArchiveFn',
  },
  {
    path: 'features/journal/services/journal-fns.ts',
    name: 'readJournalDayFn',
  },
  {
    path: 'features/journal/services/journal-fns.ts',
    name: 'saveEntryFn',
  },
  {
    path: 'features/journal/services/search-fns.ts',
    name: 'searchJournalFn',
  },
];

/**
 * Request handlers that answer without a session, each because it owns that
 * decision itself. `routes/api/healthz.ts` is the container liveness probe: it
 * answers before anyone signs in and returns a fixed status with no data behind
 * it. `routes/api/auth/$.ts` is better-auth's catch-all, where signing in
 * happens and where better-auth authenticates every request it handles. A verb
 * that appears without being listed here fails the scan.
 */
const publicRouteHandlers = [
  { path: 'routes/api/auth/$.ts', name: 'GET' },
  { path: 'routes/api/auth/$.ts', name: 'POST' },
  { path: 'routes/api/healthz.ts', name: 'GET' },
];

const privateRouteHandlers = [{ path: 'routes/_app/search.tsx', name: 'POST' }];

const app = scanModules(
  await Promise.all(
    [...new Glob('**/*.{ts,tsx}').scanSync({ cwd: sourceRoot.pathname })]
      .filter((path) => !testFile.test(path))
      .map(async (path) =>
        moduleOf(path, await file(new URL(path, sourceRoot)).text()),
      ),
  ),
);

const startImport = `import { createServerFn } from '@tanstack/react-start';`;
const guardImport = `import { sessionRequired } from '#/shared/auth/auth-middleware.ts';`;

const fixtures: Record<string, string> = {
  'journal/trailing-middleware.ts': `${startImport}
import { createMiddleware } from '@tanstack/react-start';
${guardImport}
export const readJournal = createServerFn({ method: 'GET' }).handler(() => 'secret');
export const auditLogged = createMiddleware({ type: 'function' }).middleware([sessionRequired]).server(({ next }) => next());
`,
  'journal/guarded.ts': `${startImport}
${guardImport}
export const guardedFn = createServerFn({ method: 'GET' }).middleware([sessionRequired]).handler(() => 'secret');
`,
  'journal/unguarded.ts': `${startImport}
export const unguardedFn = createServerFn({ method: 'GET' }).handler(() => 'secret');
`,
  'journal/unguarded-then-guarded.ts': `${startImport}
${guardImport}
export const firstFn = createServerFn({ method: 'GET' }).handler(() => 'secret');
export const secondFn = createServerFn({ method: 'POST' }).middleware([sessionRequired]).handler(() => 'secret');
`,
  'routes/api/shorthand-options.ts': `import { createFileRoute } from '@tanstack/react-router';
const server = { handlers: { GET: () => Response.json({ ok: true }) } };
export const Route = createFileRoute('/api/shorthand-options')({ server });
`,
  'routes/guarded.ts': `import { createFileRoute } from '@tanstack/react-router';
${guardImport}
export const Route = createFileRoute('/guarded')({ server: { middleware: [sessionRequired], handlers: { POST: () => Response.json({ ok: true }) } } });
`,
  'routes/decoy-handler.ts': `import { createFileRoute } from '@tanstack/react-router';
${guardImport}
export const Route = createFileRoute('/decoy-handler')({ server: { handlers: { POST: () => { const decoy = { middleware: [sessionRequired] }; return Response.json(decoy); } } } });
`,
  'routes/decoy-options.ts': `import { createFileRoute } from '@tanstack/react-router';
${guardImport}
export const Route = createFileRoute('/decoy-options')({ middleware: [sessionRequired], server: { handlers: { POST: () => Response.json({ ok: true }) } } });
`,
  'journal/re-exported-marker.ts': `import { createServerFn } from '#/shared/start-re-export.ts';
export const reExportedFn = createServerFn({ method: 'GET' }).handler(() => 'secret');
`,
  'journal/decoy-guard.ts': `${startImport}
import { sessionRequired } from './decoy/auth-middleware.ts';
export const decoyGuardedFn = createServerFn({ method: 'GET' }).middleware([sessionRequired]).handler(() => 'secret');
`,
  'shared/auth/relative-guard.ts': `${startImport}
import { sessionRequired } from './auth-middleware.ts';
export const relativeGuardedFn = createServerFn({ method: 'GET' }).middleware([sessionRequired]).handler(() => 'secret');
`,
  'shared/auth/session-fn.ts': `${startImport}
export const hasAuthorizedSessionFn = createServerFn({ method: 'GET' }).handler(() => true);
export const deleteEverythingFn = createServerFn({ method: 'POST' }).handler(() => true);
`,
};

const fixture = scanModules(
  Object.entries(fixtures).map(([path, source]) => moduleOf(path, source)),
);

const surfacesAt = (surfaces: ReadonlyArray<Surface>, path: string) =>
  surfaces
    .filter((surface) => surface.path === path)
    .map(({ name, guarded }) => ({ name, guarded }));

const serverFunctionsAt = (path: string) =>
  surfacesAt(fixture.serverFunctions, path);

describe('sensitive server surfaces', () => {
  it('lists every server function reachable signed out on the allowlist', () => {
    expect(reachableSignedOut(app.serverFunctions)).toEqual(
      publicServerFunctions,
    );
  });

  it('lists every server function covered by the private response boundary', () => {
    expect(
      app.serverFunctions
        .filter(({ guarded }) => guarded)
        .map(({ path, name }) => ({ path, name })),
    ).toEqual(privateServerFunctions);
  });

  it('lists every route handler reachable signed out on the allowlist', () => {
    expect(reachableSignedOut(app.routeHandlers)).toEqual(publicRouteHandlers);
  });

  it('lists every route handler covered by the private response boundary', () => {
    expect(
      app.routeHandlers
        .filter(({ guarded }) => guarded)
        .map(({ path, name }) => ({ path, name })),
    ).toEqual([...privateRouteHandlers]);
  });

  it('credits a guard only to the declaration it is chained onto', () => {
    expect(serverFunctionsAt('journal/trailing-middleware.ts')).toEqual([
      { name: 'readJournal', guarded: false },
    ]);
    expect(serverFunctionsAt('journal/guarded.ts')).toEqual([
      { name: 'guardedFn', guarded: true },
    ]);
    expect(serverFunctionsAt('journal/unguarded.ts')).toEqual([
      { name: 'unguardedFn', guarded: false },
    ]);
    expect(serverFunctionsAt('journal/unguarded-then-guarded.ts')).toEqual([
      { name: 'firstFn', guarded: false },
      { name: 'secondFn', guarded: true },
    ]);
  });

  it('treats an api route as serving requests however its options are written', () => {
    expect(
      surfacesAt(fixture.routeHandlers, 'routes/api/shorthand-options.ts'),
    ).toEqual([{ name: '(unreadable handlers)', guarded: false }]);
  });

  it('credits request middleware attached to the route server boundary', () => {
    expect(surfacesAt(fixture.routeHandlers, 'routes/guarded.ts')).toEqual([
      { name: 'POST', guarded: true },
    ]);
  });

  it('does not credit middleware-shaped decoys elsewhere in route options', () => {
    expect(
      surfacesAt(fixture.routeHandlers, 'routes/decoy-handler.ts'),
    ).toEqual([{ name: 'POST', guarded: false }]);
    expect(
      surfacesAt(fixture.routeHandlers, 'routes/decoy-options.ts'),
    ).toEqual([{ name: 'POST', guarded: false }]);
  });

  it('resolves the marker from any module and the guard from only one', () => {
    expect(serverFunctionsAt('journal/re-exported-marker.ts')).toEqual([
      { name: 'reExportedFn', guarded: false },
    ]);
    expect(serverFunctionsAt('journal/decoy-guard.ts')).toEqual([
      { name: 'decoyGuardedFn', guarded: false },
    ]);
    expect(serverFunctionsAt('shared/auth/relative-guard.ts')).toEqual([
      { name: 'relativeGuardedFn', guarded: true },
    ]);
  });

  it('names each server function, so a listed file exempts only what it lists', () => {
    expect(serverFunctionsAt('shared/auth/session-fn.ts')).toEqual([
      { name: 'deleteEverythingFn', guarded: false },
      { name: 'hasAuthorizedSessionFn', guarded: false },
    ]);
    expect(publicServerFunctions.map(({ name }) => name)).not.toContain(
      'deleteEverythingFn',
    );
  });
});
