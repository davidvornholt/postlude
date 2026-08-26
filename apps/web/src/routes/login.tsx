import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { type RefObject, useRef } from 'react';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { parseOAuthErrorSearch } from '#/shared/auth/oauth-error-search.ts';
import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import {
  columnClass,
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

// A notice is one of the few places a filled ground is right: it has to be
// found by someone who was not looking for it. It still takes a rule rather
// than a shadow, like everything else on the page.
const noticeClass = [
  readingMeasureClass,
  'mt-6 border border-critical bg-critical-subtle px-4 py-3 text-ink',
].join(' ');

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
    <main className="flex min-h-svh flex-col justify-center bg-background py-16">
      {/* No card: the page is the sign-in, set in its own column the way every
          other page is set. */}
      <div className={columnClass}>
        <p className={[eyebrowClass, 'text-accent'].join(' ')}>
          Private journal
        </p>
        <h1 className="mt-5 font-display text-5xl text-ink sm:text-6xl">
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
        <p
          className={[
            readingMeasureClass,
            'mt-8 border-border border-t pt-8 text-ink-muted text-lg',
          ].join(' ')}
        >
          A calm place to close out the day: evening writing, morning scripture
          notes, and a quiet archive.
        </p>
        <p className="mt-10">
          <button
            // Staying enabled keeps focus on the button while the request is in
            // flight; disabling it here would drop focus to <body> and announce
            // the new label to nobody.
            aria-busy={signInMutation.isPending}
            className={primaryButtonClass}
            onClick={startSignIn}
            type="button"
          >
            {signInMutation.isPending
              ? 'Opening GitHub sign-in …'
              : 'Sign in with GitHub'}
          </button>
        </p>
        {/* This one keeps `role="alert"`: it appears in response to the reader
            pressing the button, on a page they are already reading. */}
        {signInMutation.isError ? (
          <p className={noticeClass} role="alert">
            GitHub sign-in could not be started. Check your connection and try
            again.
          </p>
        ) : null}
        <p className="mt-10 text-ink-faint text-sm">
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
