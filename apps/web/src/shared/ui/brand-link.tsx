/**
 * The wordmark that links home.
 *
 * TanStack Router's `Link` marks a link to the current URL with
 * `aria-current="page"`, a `data-status="active"` attribute, and its default
 * `active` class, and it applies all three after the caller's own props, so
 * they cannot be switched off through `activeProps`. On the home page that
 * leaves two elements announcing themselves as the current page — the wordmark
 * and the "Today" nav item — where only the nav item is one. `createLink` keeps
 * the router's navigation and preloading but hands the computed props to a host
 * anchor, which is where the active markers come off.
 */

import { createLink } from '@tanstack/react-router';
import type { ComponentProps, ReactNode } from 'react';

const brandLinkClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const UnmarkedAnchor = ({
  'aria-current': _ariaCurrent,
  'data-status': _dataStatus,
  children,
  ...anchorProps
}: ComponentProps<'a'> & { readonly 'data-status'?: string }) => (
  <a {...anchorProps}>{children}</a>
);

const UnmarkedLink = createLink(UnmarkedAnchor);

export const BrandLink = ({ children }: { readonly children: ReactNode }) => (
  // Empty active class: the resolved class list is caller + active + inactive,
  // and an unset `activeProps` falls back to the router's own `active` class.
  <UnmarkedLink
    activeProps={{ className: '' }}
    className={brandLinkClass}
    to="/"
  >
    {children}
  </UnmarkedLink>
);
