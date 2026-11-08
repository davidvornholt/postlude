/**
 * Which stretch of the journal Insights is reading, and the ways to another.
 *
 * The four kinds of range sit on one track of equal segments, so the track is
 * as wide whichever is chosen, and its thumb moves the moment one is pressed,
 * before the new range has loaded, so the press is answered at once.
 *
 * The range's name is a period heading, as the calendar's month is: both steps
 * come before the name and stay put whatever its width, and a step past the
 * first written day or past today stays in its place, dimmed.
 */

import { useRouterState } from '@tanstack/react-router';

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
import {
  PeriodHeading,
  type StepDirection,
  StepGlyph,
  UnavailableStep,
} from './period-heading.tsx';

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
      <SegmentedTrack className="w-full max-w-md" count={kinds.length}>
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
  readonly direction: StepDirection;
  readonly range: InsightsRange;
  readonly bounds: Bounds;
}) => {
  const target = reachableShift(range, direction, bounds);
  const label = direction < 0 ? `Previous ${range.kind}` : `Next ${range.kind}`;
  if (target === undefined) {
    return <UnavailableStep direction={direction} label={label} />;
  }
  return (
    <ActionLink
      aria-label={label}
      resetScroll={false}
      search={insightsSearch(target, bounds.today)}
      to="/insights"
      variant="icon"
      viewTransition={pageTurn}
    >
      <StepGlyph direction={direction} />
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
  return (
    <PeriodHeading
      line={
        <>
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
        </>
      }
      steps={
        range.kind === 'all' ? null : (
          <>
            <Step bounds={bounds} direction={-1} range={range} />
            <Step bounds={bounds} direction={1} range={range} />
          </>
        )
      }
    >
      <span className="sr-only">Insights: </span>
      {rangeLabel(range)}
    </PeriodHeading>
  );
};
