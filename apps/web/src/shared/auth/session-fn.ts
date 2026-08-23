import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { getAuthorizedSession, type SessionInfo } from './session.ts';

/**
 * Reads the better-auth session from the request headers. If the session
 * lookup fails (for example when the database is unreachable), the visitor
 * counts as signed out — public routes stay reachable that way.
 */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  (): Promise<SessionInfo | null> =>
    getAuthorizedSession(getRequest().headers).catch(() => null),
);
