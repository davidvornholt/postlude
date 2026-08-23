import { describe, expect, it } from 'bun:test';
import { file, Glob } from 'bun';

const sourceRoot = new URL('../../', import.meta.url);

/**
 * A server function declaration, from the `createServerFn(` call up to and
 * including its `.handler(`. Everything that guards the call — `.middleware([…])`,
 * `.validator(…)` — sits inside that span.
 */
const serverFunctionDeclaration = /createServerFn\([\s\S]*?\.handler\(/gu;

const testFile = /\.test\.tsx?$/u;

/**
 * Server functions that must answer while signed out. `hasAuthorizedSessionFn`
 * is the signed-in check itself, so the login route calls it before any session
 * exists. Every other server function carries `sessionRequired`.
 */
const publicServerFunctionFiles = ['shared/auth/session-fn.ts'];

const findServerFunctions = async () => {
  const paths = [
    ...new Glob('**/*.{ts,tsx}').scanSync({ cwd: sourceRoot.pathname }),
  ]
    .filter((path) => !testFile.test(path))
    .sort((left, right) => left.localeCompare(right));
  const perFile = await Promise.all(
    paths.map(async (path) => {
      const source = await file(new URL(path, sourceRoot)).text();
      return [...source.matchAll(serverFunctionDeclaration)].map((match) => ({
        path,
        declaration: match[0],
      }));
    }),
  );
  return perFile.flat();
};

describe('sensitive server-function class', () => {
  it('keeps the public server-function allowlist exact', async () => {
    const serverFunctions = await findServerFunctions();
    const publicFiles = serverFunctions
      .map(({ path }) => path)
      .filter((path) => publicServerFunctionFiles.includes(path));
    expect(publicFiles).toEqual(publicServerFunctionFiles);
  });

  it('attaches authentication middleware to every other handler', async () => {
    const serverFunctions = await findServerFunctions();
    const guarded = serverFunctions.filter(
      ({ path }) => !publicServerFunctionFiles.includes(path),
    );
    for (const { path, declaration } of guarded) {
      expect(`${path}\n${declaration}`).toContain(
        '.middleware([sessionRequired])',
      );
    }
  });
});
