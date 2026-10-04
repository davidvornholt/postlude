import { expect, it } from 'bun:test';
import { csrfSymbol } from '@tanstack/react-start';

import { protectedCallErrorAdapter } from '#/shared/auth/protected-call-error.ts';
import { startInstance } from './start.ts';

it('registers the protected-call error adapter without dropping the CSRF check', async () => {
  const options = await startInstance.getOptions();

  expect(options.serializationAdapters).toContain(protectedCallErrorAdapter);
  expect(
    options.requestMiddleware?.some((middleware) => csrfSymbol in middleware),
  ).toBe(true);
});
