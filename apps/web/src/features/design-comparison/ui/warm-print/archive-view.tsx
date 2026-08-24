/**
 * The archive page: what has been kept, and the run you are on.
 *
 * The heatmap is the only picture here, so everything it shows is also written
 * down beside it — the two streaks as figures in the deep register, the total
 * in the line above the grid. Nothing on this page is known by colour alone.
 *
 * The grid sits between two hairline rules rather than inside a box. A rule
 * above and below is what marks a section off in this theme; a border on all
 * four sides would make it a card, which is the one thing the page never does.
 */

import { useId } from 'react';

import {
  archiveSample,
  writtenDays,
} from '#/features/design-comparison/archive-data.ts';
import { groupDigits } from '#/features/design-comparison/content.ts';
import { ActivityHeatmap } from '#/features/design-comparison/ui/heatmap.tsx';
import { StreakBand } from '#/features/design-comparison/ui/warm-print/streak-band.tsx';
import {
  enterClass,
  eyebrowClass,
  ruledEyebrowClass,
  wideColumnClass,
} from '#/features/design-comparison/ui/warm-print/warm-print-classes.ts';

const written = writtenDays(archiveSample.days).length;

export const WarmPrintArchive = () => {
  const streaksHeadingId = useId();
  const yearHeadingId = useId();
  const agoHeadingId = useId();

  return (
    <div className="pb-20">
      {/* No rule closes this block: the deep register's own edge is the rule,
          and a hairline stopping at the column width would cut across it. */}
      <header
        className={[wideColumnClass, enterClass, 'pt-10 pb-10 sm:pt-14'].join(
          ' ',
        )}
      >
        <h1 className="font-display text-4xl text-ink leading-tight sm:text-5xl">
          Archive
        </h1>
        <p className="mt-4 max-w-prose text-ink-muted">
          Every day you have kept, and the run you are on.
        </p>
      </header>

      <StreakBand
        headingId={streaksHeadingId}
        journalStreakDays={archiveSample.journalStreakDays}
        scriptureStreakDays={archiveSample.scriptureStreakDays}
      />

      <div className={[wideColumnClass, enterClass].join(' ')}>
        <section
          aria-labelledby={yearHeadingId}
          className="my-10 border-border border-y py-8 sm:my-14"
        >
          <h2
            className={[eyebrowClass, 'text-ink-faint'].join(' ')}
            id={yearHeadingId}
          >
            A year of days
          </h2>
          <p className="mt-3 max-w-prose text-ink-muted text-sm">
            {groupDigits(written)} days written since August 2025. Darker
            squares are longer entries.
          </p>
          <div className="mt-8">
            <ActivityHeatmap days={archiveSample.days} />
          </div>
        </section>
      </div>

      <section
        aria-labelledby={agoHeadingId}
        className={[wideColumnClass, enterClass].join(' ')}
      >
        <h2
          className={[ruledEyebrowClass, 'border-border text-ink-faint'].join(
            ' ',
          )}
          id={agoHeadingId}
        >
          One year ago
        </h2>
        <p
          className={[eyebrowClass, 'mt-6 block text-accent tabular-nums'].join(
            ' ',
          )}
        >
          {archiveSample.onThisDay.dateLabel}
        </p>
        <p className="mt-4 max-w-prose font-display text-ink text-xl italic leading-relaxed sm:text-2xl">
          {archiveSample.onThisDay.snippet}
        </p>
      </section>
    </div>
  );
};
