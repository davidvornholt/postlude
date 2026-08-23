import { auth } from '#/shared/auth/auth.ts';
import { env } from '#/shared/env.ts';
import { authorizeSession } from './authorization.ts';

export type SessionInfo = {
  readonly name: string;
};

export const getAuthorizedSession = async (
  headers: Headers,
): Promise<SessionInfo | null> => {
  const session = await authorizeSession({
    allowedAccountId: env.GITHUB_ALLOWED_ACCOUNT_ID,
    getSession: () => auth.api.getSession({ headers }),
    getAccounts: () => auth.api.listUserAccounts({ headers }),
    revokeSession: () => auth.api.signOut({ headers }),
  });
  return session ? { name: session.user.name } : null;
};
