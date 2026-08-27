import { Cause, Option, ParseResult, Runtime } from 'effect';

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

const recoveryStyles = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--pl-background, Canvas);
  color: var(--pl-ink, CanvasText);
  font-family: var(--pl-font-sans, "Inter Variable", system-ui, sans-serif);
}
main {
  display: flex;
  min-height: 100svh;
  align-items: center;
  padding: 4rem 1.25rem;
}
section { width: 100%; max-width: 42rem; margin-inline: auto; }
.eyebrow {
  margin: 0 0 1.25rem;
  color: var(--pl-ink-muted, CanvasText);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-family: var(--pl-font-display, "Fraunces Variable", "Iowan Old Style", Georgia, serif);
  font-size: clamp(2.25rem, 8vw, 3rem);
  font-weight: 400;
  line-height: 1.1;
}
.message {
  max-width: 65ch;
  margin: 2rem 0 0;
  border-top: 1px solid var(--pl-border, GrayText);
  padding-top: 2rem;
  color: var(--pl-ink-muted, CanvasText);
  font-size: 1.125rem;
  line-height: 1.6;
}
.action { margin: 2.5rem 0 0; }
a {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  background: var(--pl-primary, Highlight);
  padding: 0.625rem 1.25rem;
  color: var(--pl-on-primary, HighlightText);
  font-weight: 500;
  text-decoration: none;
}
a:hover { background: var(--pl-primary-strong, LinkText); }
a:focus-visible {
  outline: 2px solid var(--pl-primary, Highlight);
  outline-offset: 2px;
}
`;

/** Builds the only downstream non-OK response the authenticated boundary trusts. */
export const privateHtmlRecoveryResponse = ({
  actionHref,
  actionLabel,
  heading,
  message,
  title,
}: PrivateHtmlRecovery): Response => {
  const response = new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${recoveryStyles}</style></head><body><main><section aria-labelledby="recovery-heading"><p class="eyebrow">Postlude</p><h1 id="recovery-heading">${escapeHtml(heading)}</h1><p class="message">${escapeHtml(message)}</p><p class="action"><a autofocus href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a></p></section></main></body></html>`,
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
