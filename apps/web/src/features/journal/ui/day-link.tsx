/**
 * A link to one journal day.
 *
 * Today keeps the plain address. Linking a day that happens to be today to
 * `/day/<today>` would work — the route redirects — but it would put a redirect
 * between the writer and the page they use most, and it would leave two
 * addresses for one page to end up in a bookmark or a browser's history.
 *
 * The class comes from the caller because the same link is a control on the
 * writing page and a line of a table in the archive.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { JournalDate } from '../journal-day.ts';

type DayLinkProps = {
  readonly date: JournalDate;
  /** The server's own journal day, which is what "today" means everywhere. */
  readonly today: JournalDate;
  readonly className: string;
  readonly children: ReactNode;
};

export const DayLink = ({ date, today, className, children }: DayLinkProps) =>
  date === today ? (
    <Link className={className} to="/">
      {children}
    </Link>
  ) : (
    <Link className={className} params={{ date }} to="/day/$date">
      {children}
    </Link>
  );
