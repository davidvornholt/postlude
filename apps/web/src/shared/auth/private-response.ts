import { Cause, Option, ParseResult, Runtime } from 'effect';

export const privateResponseHeaders = {
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  'x-content-type-options': 'nosniff',
} as const;

export const applyPrivateResponseHeaders = (
  headers: Pick<Headers, 'set'>,
): void => {
  headers.set('cache-control', privateResponseHeaders['cache-control']);
  headers.set('pragma', privateResponseHeaders.pragma);
  headers.set(
    'x-content-type-options',
    privateResponseHeaders['x-content-type-options'],
  );
};

const failureOf = (error: unknown): unknown => {
  if (!Runtime.isFiberFailure(error)) {
    return error;
  }
  const failure = Cause.failureOption(error[Runtime.FiberFailureCauseId]);
  return Option.isSome(failure) ? failure.value : error;
};

type SafeFailure = {
  readonly message: string;
  readonly status: number;
};

const badRequest = 400;
const conflict = 409;

const taggedSafeFailure = (error: unknown): SafeFailure | undefined => {
  const failure = failureOf(error);
  if (
    typeof failure !== 'object' ||
    failure === null ||
    !('_tag' in failure) ||
    !('message' in failure) ||
    typeof failure.message !== 'string'
  ) {
    return undefined;
  }
  if (failure._tag === 'JournalValidationError') {
    return { message: failure.message, status: badRequest };
  }
  if (failure._tag === 'JournalWriteConflictError') {
    return { message: failure.message, status: conflict };
  }
  return undefined;
};

export const privateFailureResponse = (error: unknown): Response => {
  if (ParseResult.isParseError(error)) {
    return new Response('Invalid request.', {
      status: 400,
      headers: privateResponseHeaders,
    });
  }

  const safeFailure = taggedSafeFailure(error);
  if (safeFailure !== undefined) {
    return new Response(safeFailure.message, {
      status: safeFailure.status,
      headers: privateResponseHeaders,
    });
  }

  return new Response('The journal request could not be completed.', {
    status: 500,
    headers: privateResponseHeaders,
  });
};

export const unauthorizedPrivateResponse = (): Response =>
  new Response('Not authorized.', {
    status: 401,
    headers: privateResponseHeaders,
  });

export const signInPrivateRedirect = (): Response =>
  new Response(null, {
    status: 303,
    headers: { ...privateResponseHeaders, location: '/login' },
  });
