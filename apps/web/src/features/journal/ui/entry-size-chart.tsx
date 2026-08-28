import { useId } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import type { ActivityCell } from '../activity-cells.ts';
import { journalDateLabel } from '../day-label.ts';
import { entrySizeSeries } from '../entry-size.ts';
import { journalCountLabel } from '../journal-labels.ts';
import { EntrySizeLegend, EntrySizePlot } from './entry-size-plot.tsx';
import { useEntrySizeSelection } from './use-entry-size-selection.ts';

export const EntrySizeChart = ({
  cells,
}: {
  readonly cells: ReadonlyArray<ActivityCell>;
}) => {
  const detailsId = useId();
  const instructionsId = useId();
  const summaryId = useId();
  const points = entrySizeSeries(cells);
  const maximum = Math.max(0, ...points.map((point) => point.words));
  const scaleMaximum = Math.max(1, maximum);
  const {
    active,
    activeIndex,
    selectAtPointer,
    selectLatest,
    selectWithKeyboard,
  } = useEntrySizeSelection(points);

  if (active === undefined) {
    return null;
  }

  return (
    <figure className="m-0">
      <div className="flex items-baseline justify-between gap-4 text-ink-faint text-sm">
        <span>{journalCountLabel(maximum, 'word')} at the highest point</span>
        <span className="tabular-nums">7-day pace</span>
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the chart is one keyboard stop; Left, Right, Home, and End inspect its daily values without adding a year of tab stops. */}
      <section
        aria-describedby={`${summaryId} ${instructionsId} ${detailsId}`}
        aria-label="Entry size chart"
        className={['mt-3', focusRingClass].join(' ')}
        onFocus={selectLatest}
        onKeyDown={selectWithKeyboard}
        onPointerDown={selectAtPointer}
        onPointerMove={selectAtPointer}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: one focusable region exposes the chart without placing every day in the tab order.
        tabIndex={0}
      >
        <EntrySizePlot
          activeIndex={activeIndex}
          maximum={scaleMaximum}
          points={points}
        />
      </section>
      <p hidden={true} id={summaryId}>
        Daily word counts with a trailing seven-day average. The highest day
        contains {journalCountLabel(maximum, 'word')}.
      </p>
      <p hidden={true} id={instructionsId}>
        Use Left and Right to inspect days. Home and End move to the beginning
        and end.
      </p>
      <p
        aria-live="polite"
        className="mt-4 min-h-5 text-ink-muted text-sm"
        id={detailsId}
      >
        {`${journalDateLabel(active.date)} · ${active.words === 0 ? 'No writing' : journalCountLabel(active.words, 'word')} · ${journalCountLabel(active.average, 'word')} seven-day average`}
      </p>
      <EntrySizeLegend />
    </figure>
  );
};
