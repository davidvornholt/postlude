import { APIError } from 'better-auth/api';

const githubProviderId = 'github';

type GitHubProfile = {
  readonly id: number | string;
  readonly login: string;
};

type LinkedAccount = {
  readonly accountId: string;
  readonly providerId: string;
};

type Session = {
  readonly user: {
    readonly name: string;
  };
};

type SessionAuthorization = {
  readonly allowedAccountId: string;
  readonly getAccounts: () => Promise<ReadonlyArray<LinkedAccount>>;
  readonly getSession: () => Promise<Session | null>;
  readonly revokeSession: () => Promise<unknown>;
};

const isAllowedGitHubAccount = (
  account: LinkedAccount,
  allowedAccountId: string,
) =>
  account.providerId === githubProviderId &&
  account.accountId === allowedAccountId;

export const createGitHubProfileMapper =
  (allowedAccountId: string) => (profile: GitHubProfile) => {
    if (String(profile.id) !== allowedAccountId) {
      throw new APIError('FORBIDDEN', {
        message: 'This application is private.',
      });
    }
    return { name: profile.login };
  };

export const authorizeSession = async ({
  allowedAccountId,
  getAccounts,
  getSession,
  revokeSession,
}: SessionAuthorization): Promise<Session | null> => {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const accounts = await getAccounts();
  if (
    accounts.some((account) =>
      isAllowedGitHubAccount(account, allowedAccountId),
    )
  ) {
    return session;
  }

  await revokeSession().catch(() => undefined);
  return null;
};
