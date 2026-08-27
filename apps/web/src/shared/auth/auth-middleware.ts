import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { runProtectedCall } from './protected-call.ts';
import { hasAuthorizedSession } from './session.ts';

/**
 * Attach to every server function or route handler that reads or writes
 * journal data.
 */
export const sessionRequired = createMiddleware().server(async ({ next }) =>
  runProtectedCall({
    authorize: () => hasAuthorizedSession(getRequest().headers),
    next: async () => next(),
  }),
);
