import { createMiddleware } from '@tanstack/react-start';
import { getRequest, getResponseHeaders } from '@tanstack/react-start/server';

import { applyPrivateResponseHeaders } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';
import { hasAuthorizedSession } from './session.ts';

/**
 * Attach to every server function that reads or writes journal data:
 * `createServerFn().middleware([sessionRequired]).handler(...)`.
 */
export const sessionRequired = createMiddleware({
  type: 'function',
}).server(({ next }) =>
  runProtectedCall({
    authorize: () => hasAuthorizedSession(getRequest().headers),
    next: () => next(),
    publishHeaders: () => applyPrivateResponseHeaders(getResponseHeaders()),
  }),
);
