/**
 * The wordmark that links home. It is a way back, not a position in the nav,
 * so it goes through `UnmarkedLink` and never announces itself as the current
 * page.
 */

import type { ReactNode } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { UnmarkedLink } from '#/shared/ui/unmarked-link.tsx';

export const BrandLink = ({ children }: { readonly children: ReactNode }) => (
  <UnmarkedLink
    activeProps={{ className: '' }}
    className={focusRingClass}
    to="/"
  >
    {children}
  </UnmarkedLink>
);
