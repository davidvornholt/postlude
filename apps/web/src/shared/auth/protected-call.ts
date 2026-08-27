type ProtectedCall<T> = {
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<T>;
};

const unauthorizedDocument = [
  '<!doctype html>',
  '<html lang="en">',
  '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
  '<title>Sign in again</title></head>',
  // biome-ignore lint/security/noSecrets: This is fixed recovery HTML, not a credential.
  '<body><main><h1>Sign in again</h1>',
  '<p>Your session ended. Sign in again to continue.</p>',
  '<p><a href="/login">Sign in again</a></p>',
  '</main></body></html>',
].join('');

/**
 * Runs `next` only for an authorized caller. TanStack Start turns a thrown
 * `Response` into the server-function response, so an unauthorized call ends as
 * a 401 without the protected operation ever running.
 */
export const runProtectedCall = async <T>({
  authorize,
  next,
}: ProtectedCall<T>): Promise<T> => {
  if (!(await authorize())) {
    throw new Response(unauthorizedDocument, {
      status: 401,
      headers: {
        'cache-control': 'private, no-store, max-age=0',
        'content-type': 'text/html; charset=utf-8',
        pragma: 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  return next();
};
