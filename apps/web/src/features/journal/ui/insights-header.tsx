/**
 * Which stretch of the journal Insights is reading, and the ways to another.
 *
 * The four kinds of range sit on one track of equal segments, so the track is
 * as wide whichever is chosen, and its thumb moves the moment one is pressed,
 * before the new range has loaded, so the press is answered at once.
 *
 * The steps to the range before and after come before the range's name rather
 * than after it. A name changes its width with every step ("May 2026",
 * "September 2026"), and arrows placed after it would move under the pointer
 * of a reader stepping through the months; placed before it they stay put.
 */

import { useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ActionLink, UnmarkedActionLink } from '#/shared/ui/action-link.tsx';
import { SegmentLink } from '#/shared/ui/segment-link.tsx';
import { SegmentedTrack } from '#/shared/ui/segmented-control.tsx';
import {
  insightsSearch,
  searchedKind,
  switchedRange,
} from '../insights-address.ts';
import {
  type InsightsRange,
  isoWeekNumber,
  type RangeKind,
  rangeHolding,
  rangeIncludes,
  rangeLabel,
  reachableShift,
} from '../insights-range.ts';
import type { JournalDate } from '../journal-day.ts';
import { pageTurn } from '../page-turn.ts';
import { insightsSearchOf } from '../schemas/insights-query.ts';

const kinds = [
  { kind: 'week', label: 'Week' },
  { kind: 'month', label: 'Month' },
  { kind: 'year', label: 'Year' },
  { kind: 'all', label: 'All time' },
] as const satisfies ReadonlyArray<{
  readonly kind: RangeKind;
  readonly label: string;
}>;

type Bounds = { readonly earliest: JournalDate; readonly today: JournalDate };

/** The kind the reader last asked for, even while its range is still loading. */
const useRequestedKind = (shown: RangeKind): RangeKind =>
  useRouterState({
    select: (state) =>
      state.location.pathname === '/insights'
        ? searchedKind(insightsSearchOf(state.location.search))
        : undefined,
  }) ?? shown;

export const RangeSwitcher = ({
  range,
  bounds,
}: {
  readonly range: InsightsRange;
  readonly bounds: Bounds;
}) => {
  const requested = useRequestedKind(range.kind);
  return (
    <nav aria-label="Insights range">
      <SegmentedTrack
        className="w-full max-w-md"
        count={kinds.length}
        selected={kinds.findIndex(({ kind }) => kind === requested)}
      >
        {kinds.map(({ kind, label }) => (
          <SegmentLink
            key={kind}
            resetScroll={false}
            search={insightsSearch(
              switchedRange(range, kind, bounds),
              bounds.today,
            )}
            selected={kind === requested}
            to="/insights"
          >
            {label}
          </SegmentLink>
        ))}
      </SegmentedTrack>
    </nav>
  );
};

const Step = ({
  direction,
  range,
  bounds,
}: {
  readonly direction: -1 | 1;
  readonly range: InsightsRange;
  readonly bounds: Bounds;
}) => {
  const target = reachableShift(range, direction, bounds);
  if (target === undefined) {
    return <span aria-hidden="true" className="size-11" />;
  }
  const noun = range.kind;
  return (
    <ActionLink
      aria-label={direction < 0 ? `Previous ${noun}` : `Next ${noun}`}
      resetScroll={false}
      search={insightsSearch(target, bounds.today)}
      to="/insights"
      variant="icon"
      viewTransition={pageTurn}
    >
      {direction < 0 ? <ChevronLeft /> : <ChevronRight />}
    </ActionLink>
  );
};

export const RangeHeading = ({
  range,
  bounds,
}: {
  readonly range: InsightsRange;
  readonly bounds: Bounds;
}) => {
  const current = rangeIncludes(range, bounds.today);
  const stepped = range.kind !== 'all';
  return (
    // The arrows sit at the top, beside the name's first line, and the name's
    // padding centres that line on them; a name long enough to wrap on a
    // phone grows downwards and leaves the arrows where they were.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 sm:gap-x-5">
      {stepped ? (
        <div className="flex">
          <Step bounds={bounds} direction={-1} range={range} />
          <Step bounds={bounds} direction={1} range={range} />
        </div>
      ) : null}
      <h1
        className={[
          'text-balance py-1 font-display text-3xl text-ink sm:py-0.5 sm:text-4xl',
          stepped ? '' : 'col-span-2',
        ].join(' ')}
      >
        <span className="sr-only">Insights: </span>
        {rangeLabel(range)}
      </h1>
      {/* The line is kept when it is empty, so a step to a range that is not
          the current one adds a link without moving what is below. */}
      <p
        className={[
          'flex min-h-11 flex-wrap items-center gap-x-5 text-ink-faint text-sm',
          stepped ? 'col-start-2' : 'col-span-2',
        ].join(' ')}
      >
        {range.kind === 'week' ? (
          <span>{`Week ${isoWeekNumber(range.start)}`}</span>
        ) : null}
        {range.kind === 'all' || current ? null : (
          <UnmarkedActionLink
            resetScroll={false}
            search={insightsSearch(
              rangeHolding(range.kind, bounds.today),
              bounds.today,
            )}
            to="/insights"
            variant="quiet"
            viewTransition={pageTurn}
          >
            {`This ${range.kind}`}
          </UnmarkedActionLink>
        )}
      </p>
    </div>
  );
};
