/**
 * A heirloom card: hairline border, warm shadow, square corners, no rounding
 * anywhere. Cards are the theme's furniture, so the recipe lives here once and
 * every page spends only its own spacing on top of it.
 */

import type { ReactNode } from 'react';

import { cardClass } from '#/features/design-comparison/ui/heirloom/heirloom-classes.ts';

export const Card = ({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className: string;
}) => <div className={[cardClass, className].join(' ')}>{children}</div>;
