/**
 * The scan behind `sensitive-server-fns.test.ts`, kept apart from it so the
 * same scan runs over fixture modules and over `apps/web/src`. It turns a set
 * of transpiled modules into the list of server surfaces they declare and says,
 * for each, whether the session guard is attached to it.
 */

import { routeServerConfiguration } from './sensitive-route-middleware-source.ts';
import {
  type Chain,
  chainsOf,
  mentions,
} from './sensitive-server-fns-source.ts';

/** One server function, or one request handler a file route declares. */
export type Surface = {
  /** Path relative to `apps/web/src`. */
  readonly path: string;
  /** The bound name for a server function, the HTTP verb for a handler. */
  readonly name: string;
  readonly guarded: boolean;
};

/** A path relative to `apps/web/src` with the JavaScript Bun transpiled it to. */
export type Module = {
  readonly path: string;
  readonly code: string;
};

export type Scan = {
  readonly serverFunctions: ReadonlyArray<Surface>;
  readonly routeHandlers: ReadonlyArray<Surface>;
};

/**
 * The one module a `sessionRequired` binding may come from. Resolving the
 * specifier and matching the whole path — rather than accepting any specifier
 * ending in `auth-middleware.ts` — stops a decoy module elsewhere in the tree
 * from satisfying the guard check.
 */
const guardModule = 'shared/auth/auth-middleware.ts';
const apiRoutes = 'routes/api/';
const unreadableHandlers = '(unreadable handlers)';

const importStatement =
  /import\s*(?:type\s+)?(?:\{(?<clause>[^}]*)\}|\*\s*as\s+(?<namespace>[$\p{ID_Start}][$\p{ID_Continue}]*))\s*from\s*['"](?<specifier>[^'"]+)['"]/gu;
const importAlias = /\s+as\s+/u;
const handlerHint = /\b(?:server|handlers)\b/u;

/**
 * Every local name a file binds to `exportName` from a module the predicate
 * accepts — the plain import, the `as` alias, and the qualified name a
 * namespace import introduces.
 */
const localNamesOf = (
  code: string,
  exportName: string,
  accepts: (specifier: string) => boolean,
): ReadonlyArray<string> =>
  [...code.matchAll(importStatement)]
    .flatMap(({ groups }) => (groups ? [groups] : []))
    .filter(({ specifier }) => accepts(specifier ?? ''))
    .flatMap(({ clause, namespace }) =>
      namespace
        ? [`${namespace}.${exportName}`]
        : (clause ?? '')
            .split(',')
            .map((binding) => binding.trim().split(importAlias))
            .filter(([imported]) => imported === exportName)
            .map(([imported, local = imported]) => local),
    );

/** Where a specifier points, relative to `apps/web/src`; `''` when nowhere. */
const resolveSpecifier = (specifier: string, importer: string): string => {
  if (specifier.startsWith('#/')) {
    return specifier.slice(2);
  }
  if (!specifier.startsWith('.')) {
    return '';
  }
  const segments = importer.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      segments.pop();
    } else if (part !== '.' && part !== '') {
      segments.push(part);
    }
  }
  return segments.join('/');
};

/**
 * A marker is whatever local name stands for `createServerFn` or
 * `createFileRoute`, from wherever it was imported. Taking the name from any
 * module rather than only from the framework package keeps a local file that
 * re-exports the framework from hiding the declarations built on it. The cost
 * is over-flagging a same-named import from an unrelated module, which fails
 * loudly rather than quietly.
 */
const anySource = () => true;

/**
 * The request handlers a route declaration exposes. The scan only ever proves a
 * route handler-free, never handler-bearing: every route under `routes/api/`
 * counts as serving requests, as does any other route whose chain mentions
 * `server` or `handlers`. An unresolved route-options spread also counts,
 * because it may contain either. A handler-bearing route whose effective verbs
 * cannot be read reports one unreadable handler, which no allowlist entry
 * matches by accident.
 */
const handlersOf = (
  path: string,
  { text }: Chain,
  configured: ReadonlyArray<string> | null,
): ReadonlyArray<string> => {
  if (configured === null) {
    return [unreadableHandlers];
  }
  if (!(path.startsWith(apiRoutes) || handlerHint.test(text))) {
    return [];
  }
  return configured.length > 0 ? configured : [unreadableHandlers];
};

const scanModule = ({ path, code }: Module) => {
  const serverFunctionNames = localNamesOf(code, 'createServerFn', anySource);
  const routeNames = localNamesOf(code, 'createFileRoute', anySource);
  const boundaryNames = [
    ...serverFunctionNames,
    ...routeNames,
    ...localNamesOf(code, 'createMiddleware', anySource),
  ];
  const guards = localNamesOf(
    code,
    'sessionRequired',
    (specifier) => resolveSpecifier(specifier, path) === guardModule,
  );
  const isGuarded = ({ middlewareArguments }: Chain) =>
    middlewareArguments.some((list) =>
      guards.some((guard) => mentions(list, guard)),
    );
  const isRouteGuarded = (
    { middlewareArguments }: Chain,
    routeMiddlewareArguments: ReadonlyArray<string>,
  ) =>
    [...middlewareArguments, ...routeMiddlewareArguments].some((list) =>
      guards.some((guard) => mentions(list, guard)),
    );
  return {
    serverFunctions: chainsOf(code, serverFunctionNames, boundaryNames).map(
      (chain) => ({ path, name: chain.name, guarded: isGuarded(chain) }),
    ),
    routeHandlers: chainsOf(code, routeNames, boundaryNames).flatMap(
      (chain) => {
        const configuration = routeServerConfiguration(chain.text);
        return handlersOf(path, chain, configuration.handlers).map((name) => ({
          path,
          name,
          guarded:
            configuration.handlers !== null &&
            isRouteGuarded(chain, configuration.middlewareArguments),
        }));
      },
    ),
  };
};

const bySurface = (left: Surface, right: Surface) =>
  left.path === right.path
    ? left.name.localeCompare(right.name)
    : left.path.localeCompare(right.path);

export const scanModules = (modules: ReadonlyArray<Module>): Scan => {
  const scanned = modules.map(scanModule);
  return {
    serverFunctions: scanned
      .flatMap(({ serverFunctions }) => serverFunctions)
      .sort(bySurface),
    routeHandlers: scanned
      .flatMap(({ routeHandlers }) => routeHandlers)
      .sort(bySurface),
  };
};
