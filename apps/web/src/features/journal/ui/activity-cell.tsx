import type { RefCallback } from 'react';

import type { ActivityCell } from '../activity-cells.ts';
import { activityDayDetails } from '../activity-labels.ts';
import type { JournalDate } from '../journal-day.ts';
import { activityCellClass } from './activity-cell-classes.ts';

type ActivityCellViewProps = {
  readonly activeDate: JournalDate | undefined;
  readonly cell: ActivityCell;
  readonly registerCell: (date: JournalDate) => RefCallback<HTMLDivElement>;
  readonly setActiveDate: (date: JournalDate) => void;
};

const activityTargetClass = 'relative -m-1.5 size-6 shrink-0';

export const ActivityCellView = ({
  activeDate,
  cell,
  registerCell,
  setActiveDate,
}: ActivityCellViewProps) => (
  <div
    aria-hidden="true"
    className={cell.kind === 'future-padding' ? 'size-3' : activityTargetClass}
    data-activity-date={cell.kind === 'day' ? cell.date : undefined}
    data-activity-selected={
      cell.kind === 'day' && cell.date === activeDate ? 'true' : undefined
    }
    key={cell.date}
    onPointerDown={
      cell.kind === 'day' ? () => setActiveDate(cell.date) : undefined
    }
    // A pointer can stay still while keyboard focus scrolls this target
    // into view. Pointer move keeps that browser scroll from replacing the
    // keyboard selection with the cell under the stationary pointer.
    onPointerMove={
      cell.kind === 'day' ? () => setActiveDate(cell.date) : undefined
    }
    ref={registerCell(cell.date)}
    title={cell.kind === 'day' ? activityDayDetails(cell) : undefined}
  >
    {cell.kind === 'day' ? (
      <span
        aria-hidden="true"
        className={[
          'absolute inset-1.5',
          activityCellClass[cell.level],
          cell.date === activeDate
            ? 'outline outline-1 outline-ink outline-offset-1'
            : '',
        ].join(' ')}
      />
    ) : null}
  </div>
);
