import { useMutation } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { type RefObject, useId, useRef } from 'react';

import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { hasAuthorizedSessionFn } from '#/shared/auth/session-fn.ts';
import { BrandLink } from '#/shared/ui/brand-link.tsx';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import { InsideMainLandmark } from '#/shared/ui/router-fallbacks.tsx';

const navItems = [
  { to: '/', label: 'Today' },
  { to: '/archive', label: 'Archive' },
] as const;

// Router concatenates `className` with the active/inactive class rather than
// replacing it, and Tailwind emits `border-transparent` after `border-primary`
// (and `text-ink-muted` after `text-ink`), so any conflicting utility left in
// the base list would win over the active one. Border and text color therefore
// live only in the state classes, which never apply at the same time.
const navLinkClass =
  'border-b-2 px-1 pb-1 text-sm transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const navLinkActiveClass = 'border-primary font-medium text-ink';
const navLinkInactiveClass = 'border-transparent text-ink-muted hover:text-ink';

// `focus`, not `focus-visible`: the link is only reachable by keyboard, and it
// has to become visible the moment it takes focus.
const skipLinkClass =
  'sr-only text-ink text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-primary';

const AppShell = () => {
  const mainId = useId();
  const router = useRouter();
  // A ref rather than `isPending`: mutation state lands in a later render, so
  // two activations inside one React batch would both read "not pending" and
  // fire the request twice. Flipping a ref before the call closes that window.
  const signOutStarted: RefObject<boolean> = useRef(false);
  const signOutMutation = useMutation({
    mutationFn: () => authClient.signOut().then(rejectAuthError),
    onSuccess: () => router.navigate({ to: '/login' }),
    onSettled: () => {
      signOutStarted.current = false;
    },
  });
  const startSignOut = () => {
    if (signOutStarted.current) {
      return;
    }
    signOutStarted.current = true;
    signOutMutation.mutate();
  };

  return (
    <div className="relative min-h-svh bg-background">
      <a className={skipLinkClass} href={`#${mainId}`}>
        Skip to content
      </a>
      <header className="border-border border-b bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 sm:px-6">
          <p className="font-display text-2xl text-ink tracking-tight">
            <BrandLink>Postlude</BrandLink>
          </p>
          <button
            // Staying enabled keeps focus on the button while the request is
            // in flight; disabling it here would drop focus to <body> and
            // announce the new label to nobody.
            aria-busy={signOutMutation.isPending}
            className={quietButtonClass}
            onClick={startSignOut}
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
          aria-label="Main"
          className="mx-auto max-w-3xl overflow-x-auto px-4 sm:px-6"
        >
          <ul className="flex gap-5 pt-3 pb-2">
            {navItems.map((item) => (
              <li className="shrink-0" key={item.to}>
                <Link
                  activeOptions={{ exact: item.to === '/' }}
                  activeProps={{ className: navLinkActiveClass }}
                  className={navLinkClass}
                  inactiveProps={{ className: navLinkInactiveClass }}
                  to={item.to}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main
        className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8"
        id={mainId}
        tabIndex={-1}
      >
        {/* A route that fails renders its fallback here, in place of the page
            it replaces, so the fallback has to know it is already inside the
            one main landmark this page gets. */}
        <InsideMainLandmark>
          <Outlet />
        </InsideMainLandmark>
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
