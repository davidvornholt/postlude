/**
 * The frame both warm print pages sit in: the wordmark, the label that says
 * which design you are looking at, the way between the two pages, and the
 * single main landmark they render into.
 *
 * The nav is type on a rule rather than a row of buttons, which is the same
 * vocabulary the pages use for their own section openings. Hovering extends the
 * rule under a page's name from left to right; the page you are on already has
 * its rule out, in the theme's one primary colour.
 */

import { Link } from '@tanstack/react-router';
import { type ReactNode, useId } from 'react';

import {
  eyebrowClass,
  focusRingClass,
  wideColumnClass,
} from '#/features/design-comparison/ui/warm-print/warm-print-classes.ts';

const navItems = [
  { exact: true, label: 'Today', to: '/warm-print' },
  { exact: false, label: 'Archive', to: '/warm-print/archive' },
] as const;

/*
 * The rule is an `::after` on the link itself, so it spans the word exactly.
 * Its resting width and its colour live in the state classes rather than here:
 * the router appends one of them to this string, and two utilities setting the
 * same property cannot be ordered by where they sit in the attribute.
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

// `focus`, not `focus-visible`: the link is reachable only by keyboard, so it
// has to appear the moment it takes focus. It is also the one thing on this
// page that genuinely floats, and the theme casts no shadows, so a solid ground
// and a full rule are what lift it off the text underneath.
const skipLinkClass =
  'sr-only text-ink text-sm focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:border focus:border-ink focus:bg-background focus:px-4 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-primary';

export const WarmPrintShell = ({
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
      <header className="border-border border-b">
        <div
          className={[
            wideColumnClass,
            'flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 py-5',
          ].join(' ')}
        >
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-ink text-xl">Postlude</span>
            <span className={[eyebrowClass, 'text-accent'].join(' ')}>
              Warm print
            </span>
          </p>
          <nav aria-label="Pages">
            <ul className="-mb-px flex items-center gap-6">
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
      <main id={mainId} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};
