import {
  createServerEntry,
  handleStartError,
} from '@tanstack/react-start/server';

/**
 * Runs `handler` in a Start request scope, so the response helpers work, and
 * applies what they recorded, such as headers set with `setResponseHeader`, to
 * the response, as Start does when a response leaves it. Start applies that
 * state to a returned response only in its own pipeline; `handleStartError` is
 * its public way to apply it, and treats a `Response` it is given as the one to
 * finish, whether it was thrown or returned. Anything else the handler throws
 * becomes Start's error response.
 */
export const startRequestHandler = (
  handler: (request: Request) => Promise<Response> | Response,
): ((request: Request) => Promise<Response>) => {
  const entry = createServerEntry({
    fetch: async (request) => handleStartError(await handler(request)),
  });
  return async (request) => await entry.fetch(request);
};
