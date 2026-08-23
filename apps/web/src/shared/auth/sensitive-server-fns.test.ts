import { describe, expect, it } from 'bun:test';
import { file, Glob, Transpiler } from 'bun';

/**
 * Enumerates the server surfaces under `apps/web/src` — server functions and
 * the request handlers a file route declares — and asks which are reachable
 * without a session. It scans what Bun's transpiler emits rather than the file
 * as written, so a chain quoted in a doc comment can neither pose as a
 * declaration nor supply a guard, and it resolves every marker through the
 * importing file's own bindings, so a local rename hides nothing.
 */

const sourceRoot = new URL('../../', import.meta.url);

const startModule = '@tanstack/react-start';
const routerModule = '@tanstack/react-router';
const middlewareModule = '/auth-middleware.ts';

const testFile = /\.test\.tsx?$/u;
const importStatement =
  /import\s*(?:type\s+)?(?:\{(?<clause>[^}]*)\}|\*\s*as\s+(?<namespace>[$\p{ID_Start}][$\p{ID_Continue}]*))\s*from\s*['"](?<specifier>[^'"]+)['"]/gu;
const importAlias = /\s+as\s+/u;
const partOfIdentifier = /[$.\p{ID_Continue}]/u;
const callAhead = /^\s*\(/u;
const middlewareCalls = /\.middleware\s*\(/gu;
const serverKey = /\bserver\s*:/u;
const handlersKey = /\bhandlers\s*:/u;

/**
 * Server functions that must answer while signed out. `hasAuthorizedSessionFn`
 * is the signed-in check itself, so the login route calls it before any session
 * exists. Every other server function carries `sessionRequired`.
 */
const publicServerFunctionFiles = ['shared/auth/session-fn.ts'];

/**
 * Route files whose request handlers answer without a session, each because it
 * owns that decision itself. `routes/api/healthz.ts` is the container liveness
 * probe: it has to answer before anyone signs in and returns a fixed status
 * with no data behind it. `routes/api/auth/$.ts` is better-auth's catch-all,
 * where signing in happens and where better-auth authenticates every request it
 * handles. A route that grows handlers without being listed here fails the
 * scan, so exposing one stays a deliberate decision.
 */
const publicRouteHandlerFiles = [
  'routes/api/auth/$.ts',
  'routes/api/healthz.ts',
];

const transpilers = {
  ts: new Transpiler({ loader: 'ts' }),
  tsx: new Transpiler({ loader: 'tsx' }),
};

const codeOf = (path: string, source: string) =>
  transpilers[path.endsWith('.tsx') ? 'tsx' : 'ts'].transformSync(source);

/**
 * Every local name a file binds to `exportName` from a module the predicate
 * accepts — the plain import, the `as` alias, and the qualified name a
 * namespace import introduces.
 */
const localNamesOf = (
  code: string,
  exportName: string,
  isModule: (specifier: string) => boolean,
): ReadonlyArray<string> =>
  [...code.matchAll(importStatement)]
    .flatMap(({ groups }) => (groups ? [groups] : []))
    .filter(({ specifier }) => isModule(specifier))
    .flatMap(({ clause, namespace }) =>
      namespace
        ? [`${namespace}.${exportName}`]
        : clause
            .split(',')
            .map((binding) => binding.trim().split(importAlias))
            .filter(([imported]) => imported === exportName)
            .map(([imported, local = imported]) => local),
    );

/** Offsets where `name` stands alone rather than inside a longer identifier. */
const identifierOffsets = (
  code: string,
  name: string,
): ReadonlyArray<number> => {
  const offsets: Array<number> = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf(name, from);
    if (at === -1) {
      return offsets;
    }
    from = at + name.length;
    const around = code.slice(at - 1, at) + code.slice(from, from + 1);
    if (!partOfIdentifier.test(around)) {
      offsets.push(at);
    }
  }
};

/**
 * The source of each call to one of `names`, running to the next such call or
 * to the end of the file. Everything chained onto a call — `.middleware([…])`,
 * `.handler(…)`, a route's options object — sits inside that span whatever
 * line breaks the formatter chose.
 */
const declarationsOf = (
  code: string,
  names: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const starts = names
    .flatMap((name) =>
      identifierOffsets(code, name).filter((offset) =>
        callAhead.test(code.slice(offset + name.length)),
      ),
    )
    .sort((left, right) => left - right);
  return starts.map((start, index) => code.slice(start, starts.at(index + 1)));
};

/**
 * What each `.middleware(…)` in the chain was passed. Paren depth finds the end
 * of the list — it holds identifiers, arrays and calls — so the handler body
 * stays out: a guard merely mentioned there is not attached to anything.
 */
const middlewareLists = (declaration: string): ReadonlyArray<string> =>
  [...declaration.matchAll(middlewareCalls)].map(({ 0: call, index }) => {
    const open = index + call.length - 1;
    let depth = 0;
    for (let at = open; at < declaration.length; at += 1) {
      depth +=
        Number(declaration[at] === '(') - Number(declaration[at] === ')');
      if (depth === 0) {
        return declaration.slice(open + 1, at);
      }
    }
    return declaration.slice(open + 1);
  });

const scanFile = async (path: string) => {
  const code = codeOf(path, await file(new URL(path, sourceRoot)).text());
  const guards = localNamesOf(code, 'sessionRequired', (specifier) =>
    specifier.endsWith(middlewareModule),
  );
  const isStart = (specifier: string) => specifier === startModule;
  const isRouter = (specifier: string) => specifier === routerModule;
  return {
    path,
    guarded: declarationsOf(
      code,
      localNamesOf(code, 'createServerFn', isStart),
    ).map((declaration) =>
      middlewareLists(declaration).some((list) =>
        guards.some((guard) => identifierOffsets(list, guard).length > 0),
      ),
    ),
    handlerRoutes: declarationsOf(
      code,
      localNamesOf(code, 'createFileRoute', isRouter),
    ).filter(
      (declaration) =>
        serverKey.test(declaration) && handlersKey.test(declaration),
    ).length,
  };
};

const scan = await Promise.all(
  [...new Glob('**/*.{ts,tsx}').scanSync({ cwd: sourceRoot.pathname })]
    .filter((path) => !testFile.test(path))
    .sort((left, right) => left.localeCompare(right))
    .map(scanFile),
);

describe('sensitive server surfaces', () => {
  it('keeps the public server-function allowlist exact', () => {
    const declared = scan
      .filter(({ guarded }) => guarded.length > 0)
      .map(({ path }) => path);
    expect(
      declared.filter((path) => publicServerFunctionFiles.includes(path)),
    ).toEqual(publicServerFunctionFiles);
  });

  it('requires the session guard on every other server function', () => {
    const unguarded = scan.flatMap(({ path, guarded }) =>
      publicServerFunctionFiles.includes(path)
        ? []
        : guarded.filter((isSafe) => !isSafe).map(() => path),
    );
    expect(unguarded).toEqual([]);
  });

  it('keeps the public route-handler allowlist exact', () => {
    const withHandlers = scan
      .filter(({ handlerRoutes }) => handlerRoutes > 0)
      .map(({ path }) => path);
    expect(withHandlers).toEqual(publicRouteHandlerFiles);
  });
});
