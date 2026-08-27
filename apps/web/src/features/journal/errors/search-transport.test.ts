import { expect, it, mock, spyOn } from 'bun:test';
import { resolveSync } from 'bun';

import { searchTransportBoundary } from './search-errors.ts';

const privateDetails =
  'password=database-secret select * from private_entry postgres://credential';
const internalServerError = 500;

const directoryOf = (path: string): string =>
  path.slice(0, path.lastIndexOf('/'));

mock.module('#tanstack-start-server-fn-resolver', () => ({
  getServerFnById: async () =>
    Object.assign(
      async () =>
        searchTransportBoundary(Promise.reject(new Error(privateDetails))),
      { method: 'POST' },
    ),
}));

it('keeps internal database details out of TanStack Start transport', async () => {
  // The public server entry does not export the RPC handler at runtime. Resolve
  // the handler shipped inside the direct React Start dependency so this probe
  // exercises the serializer the deployed server actually uses.
  const reactStartPackage = resolveSync(
    '@tanstack/react-start/package.json',
    import.meta.dir,
  );
  const corePackage = resolveSync(
    '@tanstack/start-server-core/package.json',
    directoryOf(reactStartPackage),
  );
  const { handleServerAction } = await import(
    `${directoryOf(corePackage)}/dist/esm/server-functions-handler.js`
  );
  const storagePackage = resolveSync(
    '@tanstack/start-storage-context/package.json',
    directoryOf(corePackage),
  );
  const { runWithStartContext } = await import(
    `${directoryOf(storagePackage)}/dist/esm/index.js`
  );
  const { requestHandler } = await import('@tanstack/react-start/server');
  const request = new Request('http://localhost/_server/search-probe', {
    method: 'POST',
    headers: { 'x-tsr-serverFn': 'true' },
  });
  const handler = requestHandler((runtimeRequest: Request) =>
    runWithStartContext(
      {
        getRouter: () => {
          throw new Error('The error transport does not read the router.');
        },
        request: runtimeRequest,
        startOptions: { serializationAdapters: [] },
        contextAfterGlobalMiddlewares: {},
        executedRequestMiddlewares: new Set(),
        handlerType: 'serverFn',
      },
      () =>
        handleServerAction({
          request: runtimeRequest,
          context: {},
          serverFnId: 'search-probe',
        }),
    ),
  );
  const info = spyOn(console, 'info').mockImplementation(() => undefined);
  const error = spyOn(console, 'error').mockImplementation(() => undefined);
  const response = await handler(request, {});
  const transported = await response.text();
  info.mockRestore();
  error.mockRestore();

  expect(response.status).toBe(internalServerError);
  expect(transported).toContain('Search is unavailable right now.');
  expect(transported).not.toContain('database-secret');
  expect(transported).not.toContain('private_entry');
  expect(transported).not.toContain('postgres://credential');
});
