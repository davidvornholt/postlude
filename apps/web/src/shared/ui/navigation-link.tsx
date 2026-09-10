import { createLink } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import { eyebrowClass, focusRingClass } from './design-classes.ts';

type NavigationAnchorProps = ComponentProps<'a'> & {
  readonly current?: boolean;
};

export const NavigationLink = createLink(
  ({ current, className = '', ...props }: NavigationAnchorProps) => {
    const selected = current ?? props['aria-current'] === 'page';
    return (
      <a
        {...props}
        className={[
          eyebrowClass,
          'relative inline-block pb-2 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:transition-transform after:duration-200 after:ease-standard motion-reduce:after:transition-none',
          selected
            ? 'text-ink after:scale-x-100 after:bg-primary'
            : 'text-ink-muted after:scale-x-0 after:bg-current hover:text-ink hover:after:scale-x-100',
          focusRingClass,
          className,
        ].join(' ')}
      />
    );
  },
);
