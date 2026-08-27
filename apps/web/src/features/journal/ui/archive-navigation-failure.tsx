import { Link } from '@tanstack/react-router';

import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';

type ArchiveNavigationFailureProps = {
  readonly date: JournalDate;
  readonly onOpen: () => void;
};

export const ArchiveNavigationFailure = ({
  date,
  onOpen,
}: ArchiveNavigationFailureProps) => (
  <p className="border-critical border-y py-3 text-ink text-sm" role="alert">
    Archive stayed closed because changes from{' '}
    <Link
      className={quietButtonClass}
      onClick={onOpen}
      params={{ date }}
      to="/day/$date"
    >
      {journalDateLabel(date)}
    </Link>{' '}
    could not be saved. Open that day to recover the draft, then try Archive
    again.
  </p>
);
