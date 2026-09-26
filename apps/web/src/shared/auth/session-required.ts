import { signInPrivateRedirect } from './private-response.ts';
import { runProtectedCall } from './protected-call.ts';

type SessionRequiredCall<T> = {
  readonly transport: 'server-function' | 'route';
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<T>;
  readonly publishHeaders: () => void;
  readonly publishStatus: (status: number) => void;
};

const unauthorized = 401;

/** Functions need serializable errors even during SSR; native routes keep Responses. */
export const runSessionRequired = async <T>({
  transport,
  authorize,
  next,
  publishHeaders,
  publishStatus,
}: SessionRequiredCall<T>): Promise<T> => {
  try {
    return await runProtectedCall({ authorize, next, publishHeaders });
  } catch (error) {
    if (!(error instanceof Response)) {
      throw error;
    }
    if (transport === 'server-function') {
      publishStatus(error.status);
      // TanStack strips Error properties; plain vetted data retains recovery status.
      return Promise.reject({
        message: await error.text(),
        status: error.status,
      });
    }
    if (error.status === unauthorized) {
      throw signInPrivateRedirect();
    }
    throw error;
  }
};
