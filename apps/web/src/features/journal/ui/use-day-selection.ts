/**
 * Which day of a chart is being inspected, by pointer or by keyboard. A chart
 * is one tab stop: Left and Right step through its days, and Home and End jump
 * to the first and the last.
 */

import { type KeyboardEvent, type PointerEvent, useState } from 'react';

const destinationFor = (key: string, active: number, last: number) => {
  switch (key) {
    case 'ArrowLeft':
      return active - 1;
    case 'ArrowRight':
      return active + 1;
    case 'End':
      return last;
    case 'Home':
      return 0;
    default:
      return;
  }
};

export const useDaySelection = <Point extends { readonly date: string }>(
  points: ReadonlyArray<Point>,
  initialDate: string | undefined = points.at(-1)?.date,
) => {
  const [activeDate, setActiveDate] = useState(initialDate);
  const foundIndex = points.findIndex((point) => point.date === activeDate);
  const activeIndex =
    foundIndex < 0 ? Math.max(0, points.length - 1) : foundIndex;
  const selectLatest = (): void => setActiveDate(points.at(-1)?.date);
  const selectAtPointer = (event: PointerEvent<HTMLElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (points.length === 0 || bounds.width === 0) {
      return;
    }
    const position = Math.max(
      0,
      Math.min(bounds.width, event.clientX - bounds.left),
    );
    const index = Math.min(
      points.length - 1,
      Math.floor((position / bounds.width) * points.length),
    );
    setActiveDate(points[index]?.date);
  };
  const selectWithKeyboard = (event: KeyboardEvent<HTMLElement>): void => {
    const destination = destinationFor(
      event.key,
      activeIndex,
      points.length - 1,
    );
    if (destination === undefined) {
      return;
    }
    event.preventDefault();
    const index = Math.max(0, Math.min(points.length - 1, destination));
    setActiveDate(points[index]?.date);
  };

  return {
    active: points[activeIndex] ?? points.at(-1),
    activeIndex,
    selectAtPointer,
    selectLatest,
    selectWithKeyboard,
  } as const;
};
