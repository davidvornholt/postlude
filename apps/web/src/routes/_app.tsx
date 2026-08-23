import { useMutation } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';

const navItems = [
  { to: '/', label: 'Today' },
  { to: '/archive', label: 'Archive' },
] as const;

const navLinkClass =
  'border-b-2 border-transparent px-1 pb-1 text-ink-muted text-sm transition-colors duration-150 ease-standard hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const AppShell = () => {
  const router = useRouter();
  const signOutMutation = useMutation({
    mutationFn: () => authClient.signOut().then(rejectAuthError),
    onSuccess: () => router.navigate({ to: '/login' }),
  });

  return (
    <div className="min-h-svh bg-background">
      <header className="border-border border-b bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 sm:px-6">
          <p className="font-display text-2xl text-ink tracking-tight">
            <Link
              className="focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              to="/"
            >
              Postlude
            </Link>
          </p>
          <button
            className="text-ink-muted text-sm underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-standard hover:text-ink focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
            type="button"
          >
            {signOutMutation.isPending ? 'Signing out …' : 'Sign out'}
          </button>
          {signOutMutation.isError ? (
            <p
              className="basis-full border border-critical bg-critical-subtle px-3 py-2 text-ink text-sm"
              role="alert"
            >
              Sign-out failed. You are still signed in; check your connection
              and try again.
            </p>
          ) : null}
        </div>
        <nav
          aria-label="Main navigation"
          className="mx-auto max-w-3xl overflow-x-auto px-4 sm:px-6"
        >
          <ul className="flex gap-5 pt-3 pb-2">
            {navItems.map((item) => (
              <li className="shrink-0" key={item.to}>
                <Link
                  activeOptions={{ exact: item.to === '/' }}
                  activeProps={{
                    className: `${navLinkClass} border-primary font-medium text-ink`,
                  }}
                  className={navLinkClass}
                  to={item.to}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
};

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    if (!(await hasAuthorizedSessionFn())) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppShell,
});
