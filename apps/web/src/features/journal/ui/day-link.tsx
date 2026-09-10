import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { ActionLink } from '#/shared/ui/action-link.tsx';
import type { JournalDate } from '../journal-day.ts';

type DayLinkProps = {
  readonly date: JournalDate;
  readonly today: JournalDate;
  readonly label?: string;
  readonly children: ReactNode;
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
}: DayLinkProps) => {
  const destination =
    date === today
      ? { to: '/' as const }
      : { to: '/day/$date' as const, params: { date } };
  return variant === 'text' ? (
    <Link {...destination} aria-label={label} className={className}>
      {children}
    </Link>
  ) : (
    <ActionLink
      {...destination}
      aria-label={label}
      className={className}
      variant={variant}
    >
      {children}
    </ActionLink>
  );
};
