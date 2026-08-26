/**
 * The two controls the app has so far, in the design's own terms: one filled
 * button for the single action a page exists for, and one quiet control that is
 * type on a rule, so a control never arrives as a box on a page built out of
 * rules. The navigation is set from the same eyebrow, but its rule is a state
 * and this one's rests out — see below for why.
 *
 * Both recipes hold their state colours rather than leaving them to a caller,
 * and every caller passes the recipe alone. Two utilities that set the same
 * property are ordered by the generated stylesheet and never by the `class`
 * attribute, so a colour appended at a call site could not reliably win: a
 * control that needs different colours needs its own recipe here.
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
 * The rule is an `::after` on the control itself, so it spans the word exactly.
 * It is out at rest, which is what says the words can be pressed: a hover rule
 * is emitted inside `@media (hover: hover)` and a touch pointer never sees it,
 * so a rule the pointer drew would leave the only way out of the app reading as
 * a label on a phone. The rule takes its colour from the label, so deepening
 * the type to full ink under a pointer or a press strengthens both together —
 * the pointer weights a rule that is already there rather than drawing one.
 */
export const quietButtonClass = [
  eyebrowClass,
  'relative inline-block pb-1 text-ink-muted',
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-current',
  'transition-colors duration-150 ease-standard',
  'hover:text-ink active:text-ink',
  focusRingClass,
].join(' ');
