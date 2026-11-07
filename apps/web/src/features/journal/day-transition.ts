/**
 * How the page moves when it turns to another day: the old day slides out
 * toward the past or the future and the new one slides in from the other
 * side, so the direction of a step can be seen as well as read.
 *
 * It rides on the router's view transition, named by its type so the page's
 * stylesheet can tell the two directions apart. A reader who asks the system
 * for less motion gets no transition at all, and a browser that cannot name a
 * transition's type falls back to a plain one the stylesheet keeps still.
 */

import type { JournalDate } from './journal-day.ts';

export type DayTransition = {
  readonly types: () => Array<string> | false;
};

const asksForLessMotion = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const dayTransitionType = (
  from: JournalDate,
  to: JournalDate,
): 'day-earlier' | 'day-later' => (to < from ? 'day-earlier' : 'day-later');

export const dayTransition = (
  from: JournalDate,
  to: JournalDate,
): DayTransition => ({
  types: () => (asksForLessMotion() ? false : [dayTransitionType(from, to)]),
});
