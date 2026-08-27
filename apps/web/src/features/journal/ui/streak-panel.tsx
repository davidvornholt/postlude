/**
 * The two runs, side by side and counted separately.
 *
 * They are shown as two figures rather than one score, because they are two
 * habits: an evening that gets written and a morning that gets read. Nothing
 * here adds them together or calls either one a target — the number is the
 * writer's own, and a journal that grades its writer is a journal that gets
 * avoided.
 *
 * A run that ended is a plain zero rather than a hidden figure. The archive is
 * where the writer goes to see how it has actually been going, and a panel that
 * disappears when the answer is "not lately" is a panel that only ever agrees.
 */

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { journalCountLabel, journalNumberLabel } from '../journal-labels.ts';
import type { Streak } from '../streaks.ts';

const one = 1;

const StreakFigure = ({
  label,
  streak,
}: {
  readonly label: string;
  readonly streak: Streak;
}) => (
  <div>
    <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>{label}</p>
    <p className="mt-3 font-display text-5xl text-ink tabular-nums">
      {journalNumberLabel(streak.current)}
    </p>
    <p className="mt-1 text-ink-muted">
      {streak.current === one ? 'day in a row' : 'days in a row'}
    </p>
    <p className="mt-4 text-ink-faint text-sm">
      {`Longest run: ${journalCountLabel(streak.longest, 'day')}`}
    </p>
  </div>
);

type StreakPanelProps = {
  readonly journal: Streak;
  readonly scripture: Streak;
};

export const StreakPanel = ({ journal, scripture }: StreakPanelProps) => (
  <div className="grid gap-10 sm:grid-cols-2 sm:gap-16">
    <StreakFigure label="Evening journal" streak={journal} />
    <StreakFigure label="Morning scripture" streak={scripture} />
  </div>
);
