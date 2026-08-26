/**
 * The two controls the app has so far, in the design's own terms: one filled
 * button for the single action a page exists for, and one quiet control that is
 * type on a rule — the same vocabulary the navigation uses, so a control never
 * arrives as a box on a page built out of rules.
 *
 * Square corners and no shadow are the design rather than an omission: nothing
 * in Postlude floats, so both shadow tokens are off and there is no raised edge
 * for a radius to soften.
 */

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';

export const primaryButtonClass = [
  'inline-flex items-center justify-center bg-primary px-5 py-2.5',
  'font-medium text-on-primary',
  'transition-colors duration-150 ease-standard',
  'hover:bg-primary-strong active:bg-primary-strong',
  focusRingClass,
].join(' ');

/*
 * The rule is an `::after` on the control itself, so it spans the word exactly
 * and extends from the left as the pointer arrives. It rests at zero width, so
 * the control reads as type until it is reached.
 */
export const quietButtonClass = [
  eyebrowClass,
  'relative inline-block pb-1 text-ink-muted',
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current',
  'after:transition-transform after:duration-200 after:ease-standard motion-reduce:after:transition-none',
  'hover:text-ink hover:after:scale-x-100',
  focusRingClass,
].join(' ');
