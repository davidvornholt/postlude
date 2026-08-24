/**
 * The frame both heirloom pages sit in: the wordmark, the edition label that
 * says which design you are looking at, the way between the two pages, and the
 * single main landmark they render into.
 *
 * The nav is part of the design rather than scaffolding around it — small
 * letterspaced labels under a brass rule when current, which is the same
 * vocabulary the pages use for their own labels.
 */

import { Link } from '@tanstack/react-router';
import { type ReactNode, useId } from 'react';

import {
  focusRingClass,
  labelClass,
} from '#/features/design-comparison/ui/heirloom/heirloom-classes.ts';

const navItems = [
  { exact: true, label: 'Today', to: '/heirloom' },
  { exact: false, label: 'Archive', to: '/heirloom/archive' },
] as const;

// Colour lives only in the active/inactive classes: the router appends the
// state class to this one, so a colour left here would win over the state.
const navLinkClass = [
  'inline-block border-b-2 px-3 py-2 text-xs uppercase tracking-widest transition-colors duration-150 ease-standard motion-reduce:transition-none',
  focusRingClass,
].join(' ');
const navLinkActiveClass = 'border-accent text-ink';
const navLinkInactiveClass = 'border-transparent text-ink-muted hover:text-ink';

// `focus`, not `focus-visible`: the link is reachable only by keyboard, so it
// has to appear the moment it takes focus.
const skipLinkClass =
  'sr-only text-ink text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:shadow-card focus:outline-2 focus:outline-offset-2 focus:outline-primary';

export const HeirloomShell = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const mainId = useId();

  return (
    <div className="relative">
      <a className={skipLinkClass} href={`#${mainId}`}>
        Skip to content
      </a>
      <header className="border-border border-b bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 pt-5 pb-1 sm:px-8">
          <p className="flex items-baseline gap-3">
            <span className="font-display text-2xl text-ink tracking-tight">
              Postlude
            </span>
            <span
              className={[
                labelClass,
                'border-border-strong border-l pl-3 text-accent',
              ].join(' ')}
            >
              Heirloom
            </span>
          </p>
          <nav aria-label="Pages">
            <ul className="-mb-px flex items-center gap-2">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link
                    activeOptions={{ exact: item.exact }}
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
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12"
        id={mainId}
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
};
