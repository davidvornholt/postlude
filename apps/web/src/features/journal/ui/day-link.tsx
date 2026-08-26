/**
 * A link to one journal day.
 *
 * Today keeps the plain address. Linking a day that happens to be today to
 * `/day/<today>` would work — the route redirects — but it would put a redirect
 * between the writer and the page they use most, and it would leave two
 * addresses for one page to end up in a bookmark or a browser's history.
 *
 * The class comes from the caller because the same link is a control on the
 * writing page and a line of a table in the archive. So does the accessible
 * name, for the same reason: on the writing page the link is an arrow and has
 * to say in words where it goes, while in the archive it is the date itself and
 * a name would only repeat it.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { JournalDate } from '../journal-day.ts';

type DayLinkProps = {
  readonly date: JournalDate;
  /** The server's own journal day, which is what "today" means everywhere. */
  readonly today: JournalDate;
  readonly className: string;
  /** What the link is called when its content is a glyph rather than words. */
  readonly label?: string;
  readonly children: ReactNode;
};

export const DayLink = ({
  date,
  today,
  className,
  label,
  children,
}: DayLinkProps) =>
  date === today ? (
    <Link aria-label={label} className={className} to="/">
      {children}
    </Link>
  ) : (
    <Link
      aria-label={label}
      className={className}
      params={{ date }}
      to="/day/$date"
    >
      {children}
    </Link>
  );
