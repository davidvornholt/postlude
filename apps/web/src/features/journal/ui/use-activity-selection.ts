import { type KeyboardEvent, type RefCallback, useRef, useState } from 'react';

import type { ActivityCell } from '../activity-cells.ts';
import type { JournalDate } from '../journal-day.ts';

export type ActivityDayCell = Extract<ActivityCell, { readonly kind: 'day' }>;

type ActivityMovement = -7 | -1 | 1 | 7 | undefined;
const previousWeek: ActivityMovement = -7;
const nextWeek: ActivityMovement = 7;

const movementFor = (key: string): ActivityMovement => {
  switch (key) {
    case 'ArrowDown':
      return 1;
    case 'ArrowLeft':
      return previousWeek;
    case 'ArrowRight':
      return nextWeek;
    case 'ArrowUp':
      return -1;
    default:
      return undefined;
  }
};

export const useActivitySelection = (days: ReadonlyArray<ActivityDayCell>) => {
  const [activeDate, setActiveDate] = useState<JournalDate | undefined>(
    days.at(-1)?.date,
  );
  const elements = useRef(new Map<JournalDate, HTMLDivElement>());
  const activeDay = days.find((day) => day.date === activeDate) ?? days.at(-1);
  const activeIndex = days.findIndex((day) => day.date === activeDay?.date);
  const scrollCellIntoView = (date: JournalDate): void => {
    elements.current.get(date)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  };
  const focusLastDay = (): void => {
    const lastDay = days.at(-1);
    if (lastDay === undefined) {
      return;
    }
    setActiveDate(lastDay.date);
    scrollCellIntoView(lastDay.date);
  };
  const moveActiveDay = (event: KeyboardEvent<HTMLElement>): void => {
    const movement = movementFor(event.key);
    if (movement === undefined || activeDay === undefined) {
      return;
    }
    event.preventDefault();
    const index = Math.max(
      0,
      Math.min(days.length - 1, activeIndex + movement),
    );
    const next = days[index];
    if (next === undefined) {
      return;
    }
    setActiveDate(next.date);
    scrollCellIntoView(next.date);
  };
  const registerCell =
    (date: JournalDate): RefCallback<HTMLDivElement> =>
    (element) => {
      if (element === null) {
        elements.current.delete(date);
      } else {
        elements.current.set(date, element);
      }
    };

  return {
    activeDay,
    focusLastDay,
    moveActiveDay,
    registerCell,
    setActiveDate,
  } as const;
};
