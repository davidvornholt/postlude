/**
 * The wordmark that links home. It is a way back, not a position in the nav,
 * so it goes through `UnmarkedLink` and never announces itself as the current
 * page.
 */

import type { ReactNode } from 'react';

import { UnmarkedLink } from '#/shared/ui/unmarked-link.tsx';

const brandLinkClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const BrandLink = ({ children }: { readonly children: ReactNode }) => (
  <UnmarkedLink
    activeProps={{ className: '' }}
    className={brandLinkClass}
    to="/"
  >
    {children}
  </UnmarkedLink>
);
