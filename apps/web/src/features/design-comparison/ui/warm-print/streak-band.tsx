/**
 * The two streaks, side by side over one shared rule, in the deep register.
 *
 * They are the archive's gravity, so they get the page's inverse surface: the
 * ground goes dark under light type, the rules stay hairline, and reaching it
 * reads as turning a page. The two runs are independent — writing in the
 * evening and reading in the morning are separate habits — so they sit as
 * equals on the same rule rather than one leading the other.
 *
 * The figures are tabular, which is what lets a reader compare the two columns
 * without reading either number.
 */

import {
  deepRegisterClass,
  enterClass,
  eyebrowClass,
  ruledEyebrowClass,
  wideColumnClass,
} from '#/features/design-comparison/ui/warm-print/warm-print-classes.ts';

const figureClass = 'font-display text-5xl tabular-nums sm:text-6xl';

const Streak = ({
  days,
  label,
}: {
  readonly days: number;
  readonly label: string;
}) => (
  <div className="min-w-0">
    <p className={[eyebrowClass, 'text-deep-ink-muted'].join(' ')}>{label}</p>
    <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
      <span className={figureClass}>{days}</span>
      <span className="text-deep-ink-muted text-sm">days in a row</span>
    </p>
  </div>
);

export const StreakBand = ({
  headingId,
  journalStreakDays,
  scriptureStreakDays,
}: {
  readonly headingId: string;
  readonly journalStreakDays: number;
  readonly scriptureStreakDays: number;
}) => (
  <section
    aria-labelledby={headingId}
    className={[deepRegisterClass, enterClass].join(' ')}
  >
    <div className={[wideColumnClass, 'py-10 sm:py-14'].join(' ')}>
      <h2
        className={[
          ruledEyebrowClass,
          'border-deep-rule text-deep-ink-muted',
        ].join(' ')}
        id={headingId}
      >
        Streaks
      </h2>
      <div className="mt-8 grid gap-8 border-deep-rule border-b pb-6 sm:grid-cols-2 sm:gap-12">
        <Streak days={journalStreakDays} label="Journal" />
        <Streak days={scriptureStreakDays} label="Scripture" />
      </div>
    </div>
  </section>
);
