/**
 * What a picture of many days is shaded by. It changes the picture in place
 * rather than the address, because it is a way of looking at the same days,
 * not a different set of them.
 */

import { useId } from 'react';

import {
  SegmentedTrack,
  SegmentRadio,
} from '#/shared/ui/segmented-control.tsx';
import { type InsightsMeasure, measureOptions } from '../insights-measure.ts';

export const MeasurePicker = ({
  measure,
  onChange,
}: {
  readonly measure: InsightsMeasure;
  readonly onChange: (measure: InsightsMeasure) => void;
}) => {
  const groupId = useId();
  return (
    <fieldset>
      <legend className="sr-only">Shade by</legend>
      <SegmentedTrack
        className="w-72 max-w-full"
        count={measureOptions.length}
        selected={measureOptions.findIndex(
          (option) => option.value === measure,
        )}
      >
        {measureOptions.map((option) => (
          <SegmentRadio
            checked={option.value === measure}
            key={option.value}
            name={groupId}
            onChange={() => onChange(option.value)}
            value={option.value}
          >
            {option.label}
          </SegmentRadio>
        ))}
      </SegmentedTrack>
    </fieldset>
  );
};
