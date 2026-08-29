import { useId, useState } from 'react';

import {
  eyebrowClass,
  focusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import type { ActivityCell } from '../activity-cells.ts';
import { EntrySizeChart } from './entry-size-chart.tsx';

type EntrySizeRange = 'history' | 'window';

const rangeLabels: Record<EntrySizeRange, string> = {
  history: 'Since first entry',
  window: 'Activity range',
};

export const EntrySizeRangeControl = ({
  historyCells,
  windowCells,
}: {
  readonly historyCells: ReadonlyArray<ActivityCell>;
  readonly windowCells: ReadonlyArray<ActivityCell>;
}) => {
  const groupName = useId();
  const [range, setRange] = useState<EntrySizeRange>('window');
  const cells = range === 'history' ? historyCells : windowCells;

  return (
    <>
      <p className={[readingMeasureClass, 'text-ink-muted'].join(' ')}>
        Each vertical mark is one day. The green line shows the trailing
        seven-day average, including days without writing.
      </p>
      <fieldset className="mt-6">
        <legend className={[eyebrowClass, 'text-ink-faint'].join(' ')}>
          Entry length range
        </legend>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          {(['window', 'history'] as const).map((option) => (
            <label
              className="flex items-center gap-2 text-ink-muted has-checked:text-ink"
              key={option}
            >
              <input
                checked={range === option}
                className={['accent-primary', focusRingClass].join(' ')}
                name={groupName}
                onChange={() => setRange(option)}
                type="radio"
                value={option}
              />
              {rangeLabels[option]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-8">
        <EntrySizeChart cells={cells} key={range} />
      </div>
    </>
  );
};
