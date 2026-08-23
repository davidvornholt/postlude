import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { parseOAuthErrorSearch } from '#/shared/auth/oauth-error-search.ts';
import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const noticeClass =
  'mt-4 border border-critical bg-critical-subtle px-3 py-2 text-ink text-sm';

const SignInPage = () => {
  const { error } = Route.useSearch();
  const signInMutation = useMutation({
    mutationFn: () =>
      authClient.signIn
        .social({
          provider: 'github',
          callbackURL: '/',
          errorCallbackURL: '/login',
        })
        .then(rejectAuthError),
  });
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm border border-border bg-surface p-8 shadow-card">
        <h1 className="font-display text-4xl text-ink tracking-tight">
          Postlude
        </h1>
        <p className="mt-3 text-ink-muted">
          A calm place to close out the day: evening writing, morning scripture
          notes, and a quiet archive.
        </p>
        <button
          // Staying enabled keeps focus on the button while the request is in
          // flight; disabling it here would drop focus to <body> and announce
          // the new label to nobody.
          aria-busy={signInMutation.isPending}
          className={`${primaryButtonClass} mt-8 w-full py-3`}
          onClick={() => {
            if (signInMutation.isPending) {
              return;
            }
            signInMutation.mutate();
          }}
          type="button"
        >
          {signInMutation.isPending
            ? 'Opening GitHub sign-in …'
            : 'Sign in with GitHub'}
        </button>
        {signInMutation.isError ? (
          <p className={noticeClass} role="alert">
            GitHub sign-in could not be started. Check your connection and try
            again.
          </p>
        ) : null}
        {error === undefined ? null : (
          <p className={noticeClass} role="alert">
            Sign-in failed. This journal is private.
          </p>
        )}
        <p className="mt-4 text-ink-faint text-sm">
          Private access: only the allowed GitHub account can sign in.
        </p>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await hasAuthorizedSessionFn()) {
      throw redirect({ to: '/' });
    }
  },
  component: SignInPage,
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
  validateSearch: parseOAuthErrorSearch,
});
