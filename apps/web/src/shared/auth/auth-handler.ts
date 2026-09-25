import { Effect } from 'effect';
import { authorizeSession } from './authorization.ts';

type AuthSession = { readonly user: { readonly name: string } };
type AuthApi = {
  readonly getSession: (input: {
    readonly headers: Headers;
  }) => Promise<AuthSession | null>;
  readonly listUserAccounts: (input: {
    readonly headers: Headers;
  }) => Promise<
    ReadonlyArray<{ readonly accountId: string; readonly providerId: string }>
  >;
  readonly signOut: (input: { readonly headers: Headers }) => Promise<unknown>;
};
const unauthorizedStatus = 401;
const unavailableStatus = 503;

/** Every HTTP auth endpoint rechecks the same account policy as journal reads. */
export const createAuthorizedAuthHandler =
  ({
    api,
    handler,
    allowedAccountId,
  }: {
    readonly api: AuthApi;
    readonly handler: (request: Request) => Promise<Response>;
    readonly allowedAccountId: string;
  }) =>
  async (request: Request): Promise<Response> => {
    try {
      const { headers } = request;
      const session = await api.getSession({ headers });
      // Better Auth owns unauthenticated sign-in/callback validation and its own
      // session-required endpoints. No endpoint-name bypass is needed here.
      if (session !== null) {
        const authorized = await authorizeSession({
          allowedAccountId,
          getSession: () => Promise.resolve(session),
          getAccounts: () => api.listUserAccounts({ headers }),
          revokeSession: () => api.signOut({ headers }),
        });
        if (authorized === null) {
          return Response.json(
            {
              code: 'UNAUTHORIZED',
              message: 'Your sign-in is no longer authorized.',
            },
            {
              status: unauthorizedStatus,
              headers: { 'Cache-Control': 'no-store' },
            },
          );
        }
      }
      return await handler(request);
    } catch (error) {
      Effect.runSync(Effect.logError('Authentication request failed.', error));
      return Response.json(
        {
          code: 'AUTH_UNAVAILABLE',
          message: 'Sign-in is temporarily unavailable.',
        },
        { status: unavailableStatus, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  };
