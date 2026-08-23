type ProtectedCall<T> = {
  readonly authorize: () => Promise<boolean>;
  readonly next: () => Promise<T>;
};

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
    throw new Response('Not authorized.', { status: 401 });
  }
  return next();
};
