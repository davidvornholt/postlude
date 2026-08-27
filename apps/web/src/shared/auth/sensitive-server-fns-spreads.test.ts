import { describe, expect, it } from 'bun:test';
import { Transpiler } from 'bun';

import { scanModules } from './sensitive-server-fns-scan.ts';

const transpiler = new Transpiler({ loader: 'ts' });
const markerImport =
  "import { createFileRoute } from '@tanstack/react-router';";
const guardImport =
  "import { sessionRequired } from '#/shared/auth/auth-middleware.ts';";
const postHandlers = '{ POST: () => Response.json({ ok: true }) }';
const guardedServer = `{ middleware: [sessionRequired], handlers: ${postHandlers} }`;
const unguardedServer = `{ handlers: ${postHandlers} }`;
const unreadable = [{ name: '(unreadable handlers)', guarded: false }];

const routeSource = (
  options: string,
  declarations = '',
  imports = `${markerImport}\n${guardImport}`,
): string => `${imports}
${declarations}
export const Route = createFileRoute('/fixture')(${options});
`;

const surfacesOf = (source: string) =>
  scanModules([
    {
      path: 'routes/fixture.ts',
      code: transpiler.transformSync(source),
    },
  ]).routeHandlers.map(({ name, guarded }) => ({ name, guarded }));

describe('route option spread guard scanning', () => {
  it('uses the final route server property after ordered spreads', () => {
    expect(
      surfacesOf(
        routeSource(
          `{ server: ${guardedServer}, ...{ server: ${unguardedServer} } }`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: false }]);
    expect(
      surfacesOf(
        routeSource(
          `{ ...{ server: ${unguardedServer} }, server: ${guardedServer} }`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: true }]);
    expect(
      surfacesOf(
        routeSource(
          `{ ...unknownOptions, server: ${guardedServer} }`,
          `const unknownOptions = { server: ${unguardedServer} };`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: true }]);
  });

  it('uses the final middleware property inside nested server spreads', () => {
    expect(
      surfacesOf(
        routeSource(
          `{ server: { middleware: [sessionRequired], handlers: ${postHandlers}, ...{ middleware: [] } } }`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: false }]);
    expect(
      surfacesOf(
        routeSource(
          `{ server: { ...{ middleware: [] }, handlers: ${postHandlers}, middleware: [sessionRequired] } }`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: true }]);
  });

  it('enumerates the effective handlers inside inline spreads', () => {
    expect(
      surfacesOf(
        routeSource(
          '{ server: { middleware: [sessionRequired], handlers: { GET: () => Response.json({ ok: true }), ...{ POST: () => Response.json({ ok: true }) } } } }',
        ),
      ),
    ).toEqual([
      { name: 'GET', guarded: true },
      { name: 'POST', guarded: true },
    ]);
  });

  it('fails closed on unresolved option, server, handler, and middleware spreads', () => {
    const cases = [
      routeSource(
        '{ ...routeOptions }',
        `const routeOptions = { server: ${unguardedServer} };`,
        markerImport,
      ),
      routeSource(
        `{ server: { ...${guardedServer}, ...serverOptions } }`,
        'const serverOptions = { middleware: [] };',
      ),
      routeSource(
        '{ server: { middleware: [sessionRequired], handlers: { POST: () => Response.json({ secret: true }), ...moreHandlers } } }',
        'const moreHandlers = { DELETE: () => Response.json({ secret: true }) };',
      ),
      routeSource(
        `{ server: { middleware: [...middleware], handlers: ${postHandlers} } }`,
        'const middleware = [sessionRequired];',
      ),
    ];

    for (const source of cases) {
      expect(surfacesOf(source)).toEqual(unreadable);
    }
  });

  it('keeps marker and guard aliases and re-exports visible', () => {
    expect(
      surfacesOf(`import { createFileRoute as fileRoute } from '@tanstack/react-router';
import { sessionRequired as requireSession } from '#/shared/auth/auth-middleware.ts';
export const Route = fileRoute('/fixture')({ server: { middleware: [requireSession], handlers: { POST: () => Response.json({ ok: true }) } } });
`),
    ).toEqual([{ name: 'POST', guarded: true }]);
    expect(
      surfacesOf(
        routeSource(
          `{ server: ${guardedServer} }`,
          '',
          `import { createFileRoute } from '#/shared/router-re-export.ts';\n${guardImport}`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: true }]);
  });

  it('does not credit a guarded sibling object to the route', () => {
    expect(
      surfacesOf(
        routeSource(
          `{ server: ${unguardedServer} }`,
          `const guardedSibling = { server: ${guardedServer} };\nvoid guardedSibling;`,
        ),
      ),
    ).toEqual([{ name: 'POST', guarded: false }]);
  });
});
