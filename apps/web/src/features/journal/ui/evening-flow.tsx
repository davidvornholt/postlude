/**
 * The evening around the writing: the ratings and the day's report above it,
 * and the close and the agent note below it.
 *
 * The page follows the evening as it is lived. /wrap is started first, and
 * while it works the day is rated: energy, progress, and the optional "would
 * you repeat it". The report /wrap leaves opens only once energy and progress
 * are rated, so its numbers can't colour either rating. The report is a
 * detailed log of the time at the computer, so the writing that follows it is
 * for what the report can't know: why, what was thought and felt, and what
 * happened away from the screen. When the writing is done the day is closed,
 * which needs energy and progress and asks an agent for its note, shown last.
 *
 * A day that hasn't begun by the server's clock can't be rated at all, and an
 * evening that couldn't be read leaves a line saying so where the ratings go.
 * Either way there is nothing to close.
 */

import { type ReactNode, useId } from 'react';

import { Button } from '#/shared/ui/action.tsx';
import {
  readingMeasureClass,
  sectionHeadingClass,
} from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import {
  energyOptions,
  progressOptions,
  repeatDayOptions,
} from '../evening-labels.ts';
import { canCloseDay } from '../schemas/day-rating.ts';
import { AgentNote } from './agent-note.tsx';
import { DayReport } from './day-report.tsx';
import { RatingScale } from './rating-scale.tsx';
import type { Evening, EveningFailure } from './use-evening.ts';

const LONGEST_CLOSE_HINT = 'Rate energy and progress above to close the day.';

const closeHint = (energy: boolean, progress: boolean): string | undefined => {
  if (energy && progress) {
    return;
  }
  if (energy) {
    return 'Rate progress above to close the day.';
  }
  return progress ? 'Rate energy above to close the day.' : LONGEST_CLOSE_HINT;
};

/**
 * The button that closes the day, or reopens it, and a line under it saying
 * what is still to rate. The line is always as tall as its longest wording
 * wraps to, so rating the day never moves the note below it.
 */
const CloseButton = ({ evening }: { readonly evening: Evening }) => {
  const hintId = useId();
  const { rating, busy } = evening;
  const closed = rating.closedAt !== null;
  const hint = closed
    ? undefined
    : closeHint(rating.energy !== null, rating.progress !== null);
  return (
    <>
      <div className="flex min-h-11 flex-wrap items-center gap-x-6 gap-y-3">
        {closed ? (
          <>
            <p className="text-ink">This day is closed.</p>
            <Button
              aria-busy={busy === 'reopening'}
              disabled={busy !== undefined}
              onClick={evening.reopen}
              variant="quiet"
            >
              {busy === 'reopening' ? 'Reopening…' : 'Reopen the day'}
            </Button>
          </>
        ) : (
          <Button
            aria-busy={busy === 'closing'}
            aria-describedby={hint === undefined ? undefined : hintId}
            className="border border-transparent disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-ink-muted disabled:hover:bg-transparent"
            disabled={!canCloseDay(rating) || busy !== undefined}
            onClick={evening.close}
          >
            {busy === 'closing' ? 'Closing…' : 'Close the day'}
          </Button>
        )}
      </div>
      <p className="mt-2 grid text-ink-muted text-sm">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {LONGEST_CLOSE_HINT}
        </span>
        <span className="col-start-1 row-start-1" id={hintId}>
          {hint}
        </span>
      </p>
    </>
  );
};

/** Says why a call made from one part of the page didn't go through. */
const FailureLine = ({
  failure,
  part,
}: {
  readonly failure: EveningFailure | undefined;
  readonly part: EveningFailure['part'];
}) => (
  <div aria-live="polite" role="status">
    {failure?.part === part ? (
      <p className="mt-3 text-critical">{failure.message}</p>
    ) : null}
  </div>
);

const EveningSection = ({
  title,
  intro,
  children,
}: {
  readonly title: string;
  readonly intro: string;
  readonly children: ReactNode;
}) => {
  const headingId = useId();
  return (
    <PageFrame aria-labelledby={headingId} as="section" className="pt-12">
      <div className={readingMeasureClass}>
        <h2
          className={[sectionHeadingClass, 'text-ink'].join(' ')}
          id={headingId}
        >
          {title}
        </h2>
        <p className="mt-2 text-pretty text-ink-muted">{intro}</p>
        {children}
      </div>
    </PageFrame>
  );
};

const Ratings = ({
  evening,
  onToWriting,
}: {
  readonly evening: Evening;
  readonly onToWriting: () => void;
}) => {
  const { rating, busy } = evening;
  const locked =
    rating.closedAt !== null || busy === 'closing' || busy === 'reopening';
  return (
    <div className="mt-8">
      <RatingScale
        disabled={locked}
        legend="Energy"
        onChange={(energy) => evening.rate({ energy })}
        options={energyOptions}
        value={rating.energy}
      />
      <RatingScale
        disabled={locked}
        legend="Progress"
        onChange={(progress) => evening.rate({ progress })}
        options={progressOptions}
        value={rating.progress}
      />
      <RatingScale
        disabled={locked}
        hint="Optional. Choose it again to clear it."
        legend="Would you repeat this day?"
        onChange={(repeatDay) => evening.rate({ repeatDay })}
        onClear={() => evening.rate({ repeatDay: null })}
        options={repeatDayOptions}
        value={rating.repeatDay}
      />
      <div className="sm:pl-44">
        <FailureLine failure={evening.failure} part="ratings" />
      </div>
      <DayReport
        onToWriting={onToWriting}
        unlocked={rating.energy !== null && rating.progress !== null}
        wrap={evening.wrap}
      />
    </div>
  );
};

const ratingsIntro =
  'Rate it before you read the report, so its numbers can’t sway how the day felt.';

const unavailableMessage =
  'The ratings, report and agent note could not be loaded. Your writing is not affected. Reload the page to try again.';

/** The ratings and the report, above the writing. */
export const EveningRatings = ({
  begun,
  evening,
  onToWriting,
}: {
  /** False for a day that hasn't begun by the server's clock. */
  readonly begun: boolean;
  /** Undefined when the evening couldn't be read with the day. */
  readonly evening: Evening | undefined;
  readonly onToWriting: () => void;
}) => {
  if (!begun || evening === undefined) {
    return (
      <EveningSection intro={ratingsIntro} title="Rate the day">
        <p className="mt-8 text-ink-muted">
          {begun
            ? unavailableMessage
            : 'This day has not begun yet. Rate it once it has.'}
        </p>
      </EveningSection>
    );
  }
  return (
    <EveningSection
      intro={
        evening.rating.closedAt === null
          ? ratingsIntro
          : 'The day is closed. To change a rating, reopen it below the writing.'
      }
      title="Rate the day"
    >
      <Ratings evening={evening} onToWriting={onToWriting} />
    </EveningSection>
  );
};

/** The close and the agent note, below the writing. */
export const EveningClosing = ({
  evening,
  journalIsEmpty,
}: {
  readonly evening: Evening;
  readonly journalIsEmpty: boolean;
}) => {
  const { rating, busy } = evening;
  return (
    <EveningSection
      intro="When the writing is done, close the day."
      title="End of the day"
    >
      <div className="mt-8">
        <CloseButton evening={evening} />
        <FailureLine failure={evening.failure} part="closing" />
      </div>
      <div className="mt-12">
        <AgentNote
          blocked={busy !== undefined && busy !== 'regenerating'}
          closed={rating.closedAt !== null}
          journalIsEmpty={journalIsEmpty}
          note={evening.agentNote}
          onRegenerate={evening.regenerate}
          regenerating={busy === 'regenerating'}
        />
      </div>
    </EveningSection>
  );
};
