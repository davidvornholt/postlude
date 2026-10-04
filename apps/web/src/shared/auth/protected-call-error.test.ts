import { expect, it } from 'bun:test';
import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from '@tanstack/react-router/ssr/client';
import { resolveSync } from 'bun';

import {
  ProtectedCallError,
  protectedCallErrorAdapter,
  protectedCallErrorFrom,
} from './protected-call-error.ts';

const unauthorized = 401;

const directoryOf = (path: string): string =>
  path.slice(0, path.lastIndexOf('/'));

// Resolve the Seroval build that TanStack Router ships with, so this test
// encodes and decodes with the serializer the deployed app uses.
const routerPackage = resolveSync(
  '@tanstack/react-router/package.json',
  import.meta.dir,
);
const routerCorePackage = resolveSync(
  '@tanstack/router-core/package.json',
  directoryOf(routerPackage),
);
const { fromCrossJSON, toCrossJSONAsync } = await import(
  resolveSync('seroval', directoryOf(routerCorePackage))
);

// Start places app adapters ahead of the router defaults, as here.
const startPlugins = [
  makeSerovalPlugin(protectedCallErrorAdapter),
  ...defaultSerovalPlugins,
];

const transport = async (
  value: unknown,
  plugins: ReadonlyArray<unknown>,
): Promise<{ readonly wire: string; readonly decoded: unknown }> => {
  const wire = JSON.stringify(
    await toCrossJSONAsync(value, { refs: new Map(), plugins }),
  );
  return {
    wire,
    decoded: fromCrossJSON(JSON.parse(wire), { refs: new Map(), plugins }),
  };
};

it('carries the recovery status that TanStack drops from other errors', async () => {
  const plain = await transport(
    Object.assign(new Error('Not authorized.'), { status: unauthorized }),
    defaultSerovalPlugins,
  );
  expect(plain.decoded).toBeInstanceOf(Error);
  expect(plain.decoded).not.toHaveProperty('status');

  const vetted = await transport(
    {
      error: await protectedCallErrorFrom(
        new Response('Not authorized.', {
          status: unauthorized,
          headers: { 'x-private-diagnostic': 'server-only' },
        }),
      ),
    },
    startPlugins,
  );
  const decoded = (vetted.decoded as { readonly error: unknown }).error;
  expect(decoded).toBeInstanceOf(ProtectedCallError);
  expect(decoded).toMatchObject({
    message: 'Not authorized.',
    status: unauthorized,
  });
  for (const serverDetail of [
    '"stack"',
    '"cause"',
    'x-private-diagnostic',
    import.meta.dir,
  ]) {
    expect(vetted.wire).not.toContain(serverDetail);
  }
});

it('refuses a malformed payload instead of inventing a recovery status', () => {
  expect(() =>
    protectedCallErrorAdapter.fromSerializable({
      message: 'Not authorized.',
      status: String(unauthorized) as unknown as number,
    }),
  ).toThrow();
});
