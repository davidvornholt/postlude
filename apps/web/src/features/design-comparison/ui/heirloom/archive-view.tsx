/**
 * The archive page: what has been kept, and the run you are on.
 *
 * The heatmap is the only picture here, so everything it shows is also written
 * down beside it — the two streaks on their own cards, the total in the line
 * under the year's title. Nothing on this page is known by colour alone.
 */

import { useId } from 'react';

import {
  archiveSample,
  writtenDays,
} from '#/features/design-comparison/archive-data.ts';
import { groupDigits } from '#/features/design-comparison/content.ts';
import { ActivityHeatmap } from '#/features/design-comparison/ui/heatmap.tsx';
import { Card } from '#/features/design-comparison/ui/heirloom/card.tsx';
import {
  displayHeadingClass,
  labelClass,
} from '#/features/design-comparison/ui/heirloom/heirloom-classes.ts';
import { StatCard } from '#/features/design-comparison/ui/heirloom/stat-card.tsx';

const written = writtenDays(archiveSample.days).length;

export const HeirloomArchive = () => {
  const streaksHeadingId = useId();
  const yearHeadingId = useId();
  const agoHeadingId = useId();

  return (
    <div className="space-y-10">
      <header>
        <h1 className={[displayHeadingClass, 'text-4xl'].join(' ')}>Archive</h1>
        <p className="mt-2 text-ink-muted">
          Every day you have kept, and the run you are on.
        </p>
      </header>

      <section aria-labelledby={streaksHeadingId}>
        <h2 className={labelClass} id={streaksHeadingId}>
          Streaks
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <StatCard days={archiveSample.journalStreakDays} label="Journal" />
          <StatCard
            days={archiveSample.scriptureStreakDays}
            label="Scripture"
          />
        </div>
      </section>

      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <section aria-labelledby={yearHeadingId}>
          <h2
            className={[displayHeadingClass, 'text-2xl'].join(' ')}
            id={yearHeadingId}
          >
            A year of days
          </h2>
          <p className="mt-1 text-ink-muted text-sm">
            {groupDigits(written)} days written since August 2025. Darker
            squares are longer entries.
          </p>
          <div className="mt-6">
            <ActivityHeatmap days={archiveSample.days} />
          </div>
        </section>
      </Card>

      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <section aria-labelledby={agoHeadingId}>
          <h2 className={labelClass} id={agoHeadingId}>
            One year ago
          </h2>
          <p className={[displayHeadingClass, 'mt-2 text-xl'].join(' ')}>
            {archiveSample.onThisDay.dateLabel}
          </p>
          <p className="mt-3 max-w-prose font-display text-ink-muted text-lg italic leading-relaxed">
            {archiveSample.onThisDay.snippet}
          </p>
        </section>
      </Card>
    </div>
  );
};
