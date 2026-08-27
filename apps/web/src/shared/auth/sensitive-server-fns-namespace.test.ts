import { expect, it } from 'bun:test';
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

it('fails closed on a namespace member behind an unresolved export-all', () => {
  const scan = scanModules([
    moduleOf(
      'shared/unresolved-barrel.ts',
      `export * from './missing-factories.ts';`,
    ),
    moduleOf(
      'journal/unresolved-namespace.ts',
      `import * as Start from '#/shared/unresolved-barrel.ts';
export const unresolvedFn = Start.buildServerFn({ method: 'GET' }).handler(() => 'secret');
export const Route = Start.buildFileRoute('/unresolved')({ server: { handlers: { POST: () => Response.json({ secret: true }) } } });`,
    ),
  ]);

  expect(scan.serverFunctions.map(surfaceShape)).toEqual([
    {
      path: 'journal/unresolved-namespace.ts',
      name: 'Route',
      guarded: false,
    },
    {
      path: 'journal/unresolved-namespace.ts',
      name: 'unresolvedFn',
      guarded: false,
    },
  ]);
  expect(scan.routeHandlers.map(surfaceShape)).toEqual([
    {
      path: 'journal/unresolved-namespace.ts',
      name: '(unreadable handlers)',
      guarded: false,
    },
    {
      path: 'journal/unresolved-namespace.ts',
      name: 'POST',
      guarded: false,
    },
  ]);
});
