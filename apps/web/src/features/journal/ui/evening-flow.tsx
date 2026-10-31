/**
 * The end of the day, under the evening's writing: rate it, read what /wrap
 * measured, close it, and read what an agent made of it.
 *
 * The order is the order it is done in. Energy comes first, before the report
 * is open, so the numbers can't change how the day felt. The report opens
 * once energy is rated, and progress and the optional "would you repeat it"
 * follow, now with the numbers at hand. Closing the day needs energy and
 * progress and asks an agent for its note, which appears last.
 *
 * Each rating saves as it is chosen. A closed day shows its ratings without
 * letting them change until it is reopened. A day that hasn't begun by the
 * server's clock can't be rated at all, and says so instead.
 */

import { useId } from 'react';

import { Button } from '#/shared/ui/action.tsx';
import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import {
  energyOptions,
  progressOptions,
  repeatDayOptions,
} from '../evening-labels.ts';
import type { JournalDate } from '../journal-day.ts';
import { canCloseDay } from '../schemas/day-rating.ts';
import type { EveningActions, EveningView } from '../services/evening-fns.ts';
import { AgentNote } from './agent-note.tsx';
import { DayReport } from './day-report.tsx';
import { RatingScale } from './rating-scale.tsx';
import { type Evening, useEvening } from './use-evening.ts';

type EveningFlowProps = {
  readonly date: JournalDate;
  readonly today: JournalDate;
  /** Undefined when the evening couldn't be read with the day. */
  readonly evening: EveningView | undefined;
  readonly actions: EveningActions;
  /** The entry's latest saved revision, which a note may have fallen behind. */
  readonly entryRevision: number;
  readonly journalIsEmpty: boolean;
  readonly onBackToWriting: () => void;
};

type EveningStepsProps = Omit<EveningFlowProps, 'evening' | 'today'> & {
  readonly evening: EveningView;
};

const closeHint = (energy: boolean, progress: boolean): string | undefined => {
  if (energy && progress) {
    return;
  }
  if (energy) {
    return 'Rate progress to close the day.';
  }
  return progress
    ? 'Rate energy to close the day.'
    : 'Rate energy and progress to close the day.';
};

const DayClosing = ({ evening }: { readonly evening: Evening }) => {
  const hintId = useId();
  const { rating, busy } = evening;
  if (rating.closedAt !== null) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <p className="font-display text-ink text-xl">This day is closed.</p>
        <Button
          aria-busy={busy === 'reopening'}
          disabled={busy !== undefined}
          onClick={evening.reopen}
          variant="quiet"
        >
          {busy === 'reopening' ? 'Reopening…' : 'Reopen the day'}
        </Button>
      </div>
    );
  }
  const hint = closeHint(rating.energy !== null, rating.progress !== null);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Button
        aria-busy={busy === 'closing'}
        aria-describedby={hint === undefined ? undefined : hintId}
        className="border border-transparent disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-ink-muted disabled:hover:bg-transparent"
        disabled={!canCloseDay(rating) || busy !== undefined}
        onClick={evening.close}
      >
        {busy === 'closing' ? 'Closing…' : 'Close the day'}
      </Button>
      {hint === undefined ? null : (
        <p className="text-ink-muted text-sm" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
};

const EveningSteps = ({
  evening: initial,
  actions,
  entryRevision,
  journalIsEmpty,
  onBackToWriting,
}: EveningStepsProps) => {
  const evening = useEvening(initial, actions, entryRevision);
  const { rating, busy } = evening;
  const closed = rating.closedAt !== null;
  const locked = closed || busy === 'closing' || busy === 'reopening';

  return (
    <div className="mt-6 flex flex-col gap-10">
      <RatingScale
        disabled={locked}
        legend="Energy"
        onChange={(energy) => evening.rate({ energy })}
        options={energyOptions}
        value={rating.energy}
      />
      <DayReport
        onBackToWriting={onBackToWriting}
        unlocked={rating.energy !== null}
        wrap={evening.wrap}
      />
      <RatingScale
        disabled={locked}
        legend="Progress"
        onChange={(progress) => evening.rate({ progress })}
        options={progressOptions}
        value={rating.progress}
      />
      <RatingScale
        clear={{
          label: 'Clear this answer',
          run: () => evening.rate({ repeatDay: null }),
        }}
        disabled={locked}
        hint="Optional."
        legend="Would you repeat this day?"
        onChange={(repeatDay) => evening.rate({ repeatDay })}
        options={repeatDayOptions}
        value={rating.repeatDay}
      />
      <div>
        <DayClosing evening={evening} />
        <div aria-live="polite" role="status">
          {evening.failure === undefined ? null : (
            <p className="mt-3 text-critical">{evening.failure}</p>
          )}
        </div>
      </div>
      <div className="border-border border-t pt-8">
        <AgentNote
          blocked={busy !== undefined && busy !== 'regenerating'}
          closed={closed}
          journalIsEmpty={journalIsEmpty}
          note={evening.agentNote}
          onRegenerate={evening.regenerate}
          regenerating={busy === 'regenerating'}
        />
      </div>
    </div>
  );
};

const unavailableMessage =
  'The ratings, report and agent note could not be loaded. Your writing is not affected. Reload the page to try again.';

export const EveningFlow = ({ today, ...props }: EveningFlowProps) => {
  const headingId = useId();
  const { date, evening } = props;
  let content = (
    <p className="mt-6 text-ink-muted">
      This day has not begun yet. Rate and close it once it has.
    </p>
  );
  if (date <= today) {
    content =
      evening === undefined ? (
        <p className="mt-6 text-ink-muted">{unavailableMessage}</p>
      ) : (
        <EveningSteps {...props} evening={evening} />
      );
  }

  return (
    <PageFrame
      aria-labelledby={headingId}
      as="section"
      className="mt-14 sm:mt-20"
    >
      <div
        className={[readingMeasureClass, 'border-border border-t pt-10'].join(
          ' ',
        )}
      >
        <h2
          className={[eyebrowClass, 'text-ink-muted'].join(' ')}
          id={headingId}
        >
          Looking back
        </h2>
        {content}
      </div>
    </PageFrame>
  );
};
