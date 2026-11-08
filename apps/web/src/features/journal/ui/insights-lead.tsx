/**
 * The range in a sentence or two, before any chart: how much got written and
 * how the days felt. It is what a reader who looks for five seconds takes
 * away, so it is set as prose rather than as a row of figures to decode, and
 * it says "so far" while the range is still going.
 */

import { readingMeasureClass } from '#/shared/ui/design-classes.ts';
import { ratingCounts } from '../day-measures.ts';
import { energyOptions } from '../evening-labels.ts';
import { writingSummary } from '../insights-patterns.ts';
import {
  type InsightsRange,
  rangeIncludes,
  rangeNoun,
} from '../insights-range.ts';
import type { InsightsView } from '../insights-view.ts';
import { journalCountLabel, journalNumberLabel } from '../journal-labels.ts';

const Figure = ({ children }: { readonly children: string }) => (
  <span className="text-ink tabular-nums">{children}</span>
);

const leadClass = [
  readingMeasureClass,
  'text-balance font-display text-ink-muted text-xl leading-snug sm:text-2xl',
].join(' ');

const listed = (parts: ReadonlyArray<string>): string =>
  parts.length < 2
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;

/** "9 days felt fresh, 14 okay and 4 drained." from the best answer down. */
const energySentence = (view: InsightsView): string | undefined => {
  const { counts } = ratingCounts(
    view.days,
    view.today,
    energyOptions.map((option) => option.value),
    (day) => day.energy,
  );
  const parts = [...energyOptions]
    .reverse()
    .flatMap((option) => {
      const count = counts.get(option.value) ?? 0;
      return count === 0 ? [] : [{ count, label: option.label.toLowerCase() }];
    })
    .map(({ count, label }, index) =>
      index === 0
        ? `${journalCountLabel(count, 'day')} felt ${label}`
        : `${journalNumberLabel(count)} ${label}`,
    );
  return parts.length === 0 ? undefined : `${listed(parts)}.`;
};

const writtenVerb = (range: InsightsRange, current: boolean): string => {
  if (range.kind === 'all') {
    return 'You have written on';
  }
  return current ? 'So far you have written on' : 'You wrote on';
};

export const InsightsLead = ({ view }: { readonly view: InsightsView }) => {
  const { range, today } = view;
  const noun = rangeNoun(range.kind);
  const current = rangeIncludes(range, today);
  const summary = writingSummary(view.days, today);

  if (summary.elapsed === 0) {
    return <p className={leadClass}>{`This ${noun} has not started yet.`}</p>;
  }
  if (view.earliest === undefined) {
    return (
      <p className={leadClass}>
        Nothing written yet. Insights fill in as the days do.
      </p>
    );
  }
  const energy = energySentence(view);
  if (summary.written === 0) {
    return (
      <p className={leadClass}>
        {current
          ? `Nothing written yet this ${noun}.`
          : `Nothing was written that ${noun}.`}
        {energy === undefined ? null : ` ${energy}`}
      </p>
    );
  }
  return (
    <p className={leadClass}>
      {writtenVerb(range, current)}{' '}
      <Figure>{journalNumberLabel(summary.written)}</Figure> of{' '}
      <Figure>{journalCountLabel(summary.elapsed, 'day')}</Figure>,{' '}
      <Figure>{journalCountLabel(summary.words, 'word')}</Figure> in all.
      {energy === undefined ? null : ` ${energy}`}
    </p>
  );
};
