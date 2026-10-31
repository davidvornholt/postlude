import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { ActionLink } from '#/shared/ui/action-link.tsx';
import type { JournalDate } from '../journal-day.ts';

type DayLinkProps = {
  readonly date: JournalDate;
  readonly today: JournalDate;
  readonly label?: string;
  readonly children: ReactNode;
  readonly 'aria-describedby'?: string;
  readonly 'aria-keyshortcuts'?: string;
  /** Lets focus come back to this link's twin on the page it opens. */
  readonly 'data-focus-key'?: string;
  readonly title?: string;
} & (
  | { readonly variant: 'icon' | 'quiet'; readonly className?: string }
  | { readonly variant: 'text'; readonly className: string }
);

// Today keeps its canonical plain URL, avoiding a redirect before the entry opens.
export const DayLink = ({
  date,
  today,
  variant,
  className,
  label,
  children,
  ...attributes
}: DayLinkProps) => {
  const destination =
    date === today
      ? { to: '/' as const }
      : { to: '/day/$date' as const, params: { date } };
  return variant === 'text' ? (
    <Link
      {...destination}
      {...attributes}
      aria-label={label}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <ActionLink
      {...destination}
      {...attributes}
      aria-label={label}
      className={className}
      variant={variant}
    >
      {children}
    </ActionLink>
  );
};
