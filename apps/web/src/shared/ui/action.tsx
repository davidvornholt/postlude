import type { ComponentProps } from 'react';

import { eyebrowClass, focusRingClass } from './design-classes.ts';

type ActionVariant = 'primary' | 'quiet' | 'icon' | 'plain';
type ActionAppearance = {
  readonly variant?: ActionVariant;
  readonly size?: 'default' | 'dialog';
};

const appearance = (variant: ActionVariant, size: 'default' | 'dialog') => {
  switch (variant) {
    case 'primary':
      return `bg-primary font-medium text-on-primary ${size === 'dialog' ? 'min-h-11 px-4 disabled:opacity-60' : 'inline-flex items-center justify-center px-5 py-2.5 hover:bg-primary-strong active:bg-primary-strong'}`;
    case 'quiet':
      return `${eyebrowClass} relative inline-block pb-1 text-ink-muted after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-current hover:text-ink active:text-ink`;
    case 'plain':
      return 'min-h-11 px-3';
    default:
      return 'inline-flex h-11 w-11 items-center justify-center text-2xl text-ink-muted leading-none hover:text-ink active:text-ink';
  }
};

export const Button = ({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & ActionAppearance) => (
  <button
    {...props}
    type={type}
    className={`${appearance(variant, size)} transition-colors duration-150 ease-standard ${focusRingClass} ${className}`}
  />
);

// Navigation remains a native anchor, including recovery pages without JavaScript.
export const ActionAnchor = ({
  variant = 'primary',
  size = 'default',
  className = '',
  ...props
}: ComponentProps<'a'> & ActionAppearance) => (
  <a
    {...props}
    className={`${appearance(variant, size)} transition-colors duration-150 ease-standard ${focusRingClass} ${className}`}
  />
);
