import { ActionLink } from '#/shared/ui/action-link.tsx';

import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';

type InsightsNavigationFailureProps = {
  readonly date: JournalDate;
  readonly onOpen: () => void;
};

export const InsightsNavigationFailure = ({
  date,
  onOpen,
}: InsightsNavigationFailureProps) => (
  <p className="border-critical border-y py-3 text-ink text-sm" role="alert">
    Insights stayed closed because changes from{' '}
    <ActionLink
      variant="quiet"
      onClick={onOpen}
      params={{ date }}
      to="/day/$date"
    >
      {journalDateLabel(date)}
    </ActionLink>{' '}
    could not be saved. Open that day to recover the draft, then try Insights
    again.
  </p>
);
