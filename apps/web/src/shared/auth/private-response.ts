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

const taggedValidationMessage = (error: unknown): string | undefined => {
  const failure = failureOf(error);
  // JournalValidationError's contract approves its message for the reader.
  // Other Effect failures may retain SQL details and must stay opaque.
  if (
    typeof failure !== 'object' ||
    failure === null ||
    !('_tag' in failure) ||
    failure._tag !== 'JournalValidationError' ||
    !('message' in failure) ||
    typeof failure.message !== 'string'
  ) {
    return undefined;
  }
  return failure.message;
};

export const privateFailureResponse = (error: unknown): Response => {
  if (ParseResult.isParseError(error)) {
    return new Response('Invalid request.', {
      status: 400,
      headers: privateResponseHeaders,
    });
  }

  const validationMessage = taggedValidationMessage(error);
  if (validationMessage !== undefined) {
    return new Response(validationMessage, {
      status: 400,
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
