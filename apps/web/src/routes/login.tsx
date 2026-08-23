import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { type RefObject, useRef } from 'react';

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
  // A ref rather than `isPending`: mutation state lands in a later render, so
  // two activations inside one React batch would both read "not pending" and
  // open the OAuth redirect twice. Flipping a ref before the call closes that
  // window.
  const signInStarted: RefObject<boolean> = useRef(false);
  const signInMutation = useMutation({
    mutationFn: () =>
      authClient.signIn
        .social({
          provider: 'github',
          callbackURL: '/',
          errorCallbackURL: '/login',
        })
        .then(rejectAuthError),
    onSettled: () => {
      signInStarted.current = false;
    },
  });
  const startSignIn = () => {
    if (signInStarted.current) {
      return;
    }
    signInStarted.current = true;
    signInMutation.mutate();
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm border border-border bg-surface p-8 shadow-card">
        <h1 className="font-display text-4xl text-ink tracking-tight">
          Postlude
        </h1>
        {/* No `role="alert"`: this notice is in the server-rendered markup of a
            freshly loaded page, not inserted into a page the reader is already
            on, so there is nothing for a live region to announce. Reading order
            right after the heading is what carries it instead.

            One wording for every code better-auth can put in `?error=`. The one
            this app produces itself, `account_not_allowed`, is permanent: the
            account gate turns the same GitHub account away every time, so copy
            that told the reader to try again would send them round a loop that
            cannot end. The rest — a cancelled consent screen, an expired or
            mismatched sign-in state, a failed token exchange — are transient,
            and for those the button below is right there. So the notice states
            what happened, names the one condition that makes another attempt
            pointless, and promises nothing either way. */}
        {error === undefined ? null : (
          <p className={noticeClass}>
            Sign-in did not go through, so you are still signed out. If the
            GitHub account you used is not the one with access, trying again
            will end the same way.
          </p>
        )}
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
          onClick={startSignIn}
          type="button"
        >
          {signInMutation.isPending
            ? 'Opening GitHub sign-in …'
            : 'Sign in with GitHub'}
        </button>
        {/* This one keeps `role="alert"`: it appears in response to the reader
            pressing the button, on a page they are already reading. */}
        {signInMutation.isError ? (
          <p className={noticeClass} role="alert">
            GitHub sign-in could not be started. Check your connection and try
            again.
          </p>
        ) : null}
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
