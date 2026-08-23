import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { getSessionFn } from '#/shared/auth/session-fn.ts';
import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const SignInPage = () => {
  const signInMutation = useMutation({
    mutationFn: () =>
      authClient.signIn
        .social({ provider: 'github', callbackURL: '/' })
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
          className={`${primaryButtonClass} mt-8 w-full py-3`}
          disabled={signInMutation.isPending}
          onClick={() => signInMutation.mutate()}
          type="button"
        >
          {signInMutation.isPending
            ? 'Opening GitHub sign-in …'
            : 'Sign in with GitHub'}
        </button>
        {signInMutation.isError ? (
          <p
            className="mt-4 border border-critical bg-critical-subtle px-3 py-2 text-ink text-sm"
            role="alert"
          >
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
    const session = await getSessionFn();
    if (session !== null) {
      throw redirect({ to: '/' });
    }
  },
  component: SignInPage,
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
});
