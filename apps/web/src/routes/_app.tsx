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
import {
  columnClass,
  eyebrowClass,
  focusRingClass,
} from '#/shared/ui/design-classes.ts';
import { accountActionClass } from '#/shared/ui/form-classes.ts';
import { InsideMainLandmark } from '#/shared/ui/router-fallbacks.tsx';

const navItems = [
  { to: '/', label: 'Today' },
  { to: '/archive', label: 'Archive' },
] as const;

/*
 * The nav is type on a rule rather than a row of buttons, because a page built
 * out of rules should not sprout a row of boxes to move around itself. Hovering
 * extends the rule under a page's name from left to right; the page you are on
 * already has its rule out, in the one primary colour.
 *
 * The rule here is a state, unlike the sign-out control's, which rests out. The
 * difference is what each one has to say: this rule answers "which page is
 * this", and the current page's is always drawn, so a pointer that draws
 * another adds information rather than being the only way to get any.
 *
 * The rule's resting width and its colour live in the state classes rather than
 * in the base string: the router appends one of them to this one, and two
 * utilities setting the same property cannot be ordered by where they sit in a
 * `class` attribute.
 */
const navLinkClass = [
  eyebrowClass,
  'relative inline-block pb-2',
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left',
  'after:transition-transform after:duration-200 after:ease-standard motion-reduce:after:transition-none',
  focusRingClass,
].join(' ');
const navLinkActiveClass = 'text-ink after:scale-x-100 after:bg-primary';
const navLinkInactiveClass =
  'text-ink-muted after:scale-x-0 after:bg-current hover:text-ink hover:after:scale-x-100';

// `focus`, not `focus-visible`: the link is only reachable by keyboard, so it
// has to appear the moment it takes focus. It is also the one thing on the page
// that genuinely floats, and the design casts no shadows, so a solid ground and
// a full rule are what lift it off the text underneath.
const skipLinkClass =
  'sr-only text-ink text-sm focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:border focus:border-ink focus:bg-background focus:px-4 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-primary';

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
      <header className="border-border border-b">
        <div
          className={[
            columnClass,
            'flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 py-5',
          ].join(' ')}
        >
          <p className="font-display text-ink text-xl">
            <BrandLink>Postlude</BrandLink>
          </p>
          <div className="flex items-center">
            <nav aria-label="Main">
              <ul className="flex items-center gap-6">
                {navItems.map((item) => (
                  <li key={item.to}>
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
            {/* A hairline, because the pages and the way out of the app are
                different in kind and were reading as one row of three. */}
            <div className="ml-6 border-border border-l pl-6">
              <button
                // Staying enabled keeps focus on the button while the request
                // is in flight; disabling it here would drop focus to <body>
                // and announce the new label to nobody.
                aria-busy={signOutMutation.isPending}
                className={accountActionClass}
                onClick={startSignOut}
                type="button"
              >
                {signOutMutation.isPending ? 'Signing out …' : 'Sign out'}
              </button>
            </div>
          </div>
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
      </header>
      {/* No column here. The page sets its own measure — the text column for
          writing, the wider one for the archive — because the deep register
          has to run edge to edge, and it cannot escape a column the shell has
          already set around every page. */}
      <main className="py-10 sm:py-14" id={mainId} tabIndex={-1}>
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
