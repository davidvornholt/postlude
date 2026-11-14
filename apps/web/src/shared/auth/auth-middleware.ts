import { createMiddleware } from '@tanstack/react-start';
import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from '@tanstack/react-start/server';

import { applyPrivateResponseHeaders } from './private-response.ts';
import { hasAuthorizedSession } from './session.ts';
import { runSessionRequired } from './session-required.ts';

/** Attach to every server function or route handler that reads or writes journal data. */
export const sessionRequired = createMiddleware().server(
  ({ next, serverFnMeta }) => {
    const request = getRequest();
    return runSessionRequired({
      // Framework metadata is present for both SSR and RPC function execution.
      // A caller-controlled HTTP header cannot select this transport.
      transport: serverFnMeta === undefined ? 'route' : 'server-function',
      authorize: () => hasAuthorizedSession(request.headers),
      next: async () => next(),
      // `getResponseHeaders` returns a copy; only the setters reach the response.
      publishHeaders: () =>
        applyPrivateResponseHeaders({ set: setResponseHeader }),
      publishStatus: (status) => setResponseStatus(status),
    });
  },
);
