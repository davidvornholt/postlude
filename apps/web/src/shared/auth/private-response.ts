import { Cause, Option, ParseResult, Runtime } from 'effect';

import { columnClass, eyebrowClass } from '#/shared/ui/design-classes.ts';
import { primaryButtonClass } from '#/shared/ui/form-classes.ts';

export const privateResponseHeaders = {
  'cache-control': 'private, no-store, max-age=0',
  pragma: 'no-cache',
  'x-content-type-options': 'nosniff',
} as const;

const approvedPrivateResponses = new WeakSet<Response>();

type PrivateHtmlRecovery = {
  readonly actionHref: string;
  readonly actionLabel: string;
  readonly heading: string;
  readonly message: string;
  readonly styleSheetHref: string;
  readonly title: string;
};

const escapeHtml = (value: string): string =>
  value.replaceAll(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

/** Builds the only downstream non-OK response the authenticated boundary trusts. */
export const privateHtmlRecoveryResponse = ({
  actionHref,
  actionLabel,
  heading,
  message,
  styleSheetHref,
  title,
}: PrivateHtmlRecovery): Response => {
  const response = new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="${escapeHtml(styleSheetHref)}"></head><body><main class="flex min-h-svh flex-col justify-center bg-background py-16"><div class="${columnClass}"><section aria-labelledby="recovery-heading"><p class="${eyebrowClass} text-ink-faint">Postlude</p><h1 class="mt-5 font-display text-4xl text-ink sm:text-5xl" id="recovery-heading">${escapeHtml(heading)}</h1><p class="mt-8 max-w-prose border-border border-t pt-8 text-ink-muted text-lg">${escapeHtml(message)}</p><p class="mt-10"><a autofocus class="${primaryButtonClass}" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a></p></section></div></main></body></html>`,
    {
      status: 503,
      headers: {
        ...privateResponseHeaders,
        'content-type': 'text/html; charset=utf-8',
      },
    },
  );
  approvedPrivateResponses.add(response);
  return response;
};

export const isApprovedPrivateResponse = (response: Response): boolean =>
  approvedPrivateResponses.has(response);

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
