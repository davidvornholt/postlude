/**
 * The controls the app has so far, in the design's own terms: one filled button
 * for the single action a page exists for, one quiet control that is type on a
 * rule, one navigation link that is the same eyebrow with the rule as its
 * state, and two text fields that are also type on a rule — one for the
 * parchment ground and one for the deep register — so a control never arrives
 * as a box on a page built out of rules.
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

import {
  deepFocusRingClass,
  eyebrowClass,
  focusRingClass,
} from '#/shared/ui/design-classes.ts';

/*
 * A link in a row of links, where one of them is the one you are looking at:
 * the shell's two pages, and the archive's years. Type on a rule rather than a
 * row of buttons, because a page built out of rules should not sprout a row of
 * boxes to move around itself. Hovering extends the rule under a name from left
 * to right; the one you are on already has its rule out, in the one primary
 * colour.
 *
 * The rule here is a state, unlike the quiet control's, which rests out. The
 * difference is what each one has to say: this rule answers "which one is
 * this", and the current one's is always drawn, so a pointer that draws another
 * adds information rather than being the only way to get any.
 *
 * The rule's resting width and its colour live in the two state classes rather
 * than in the base, because a caller appends one of them to the other and two
 * utilities setting the same property cannot be ordered by where they sit in a
 * `class` attribute.
 */
export const navLinkClass = [
  eyebrowClass,
  'relative inline-block pb-2',
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left',
  'after:transition-transform after:duration-200 after:ease-standard motion-reduce:after:transition-none',
  focusRingClass,
].join(' ');

export const navLinkActiveClass = 'text-ink after:scale-x-100 after:bg-primary';

export const navLinkInactiveClass =
  'text-ink-muted after:scale-x-0 after:bg-current hover:text-ink hover:after:scale-x-100';

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

/*
 * A single-line field on the parchment ground: the same rule with type on it as
 * the deep register's, in the page's own ink. It is a separate recipe rather
 * than the deep one with colours appended, for the reason at the top of this
 * file — two utilities that set the same property are ordered by the generated
 * stylesheet, so a colour added at a call site cannot be relied on to win.
 */
export const fieldClass = [
  'w-full border-border border-b bg-transparent pb-1',
  'text-ink placeholder:text-ink-muted placeholder:italic',
  'transition-colors duration-150 ease-standard',
  'hover:border-ink-muted focus:border-ink',
  focusRingClass,
].join(' ');

/*
 * A single-line field, in the deep register. It is a rule with type on it
 * rather than a box: an outlined input would be the one card on a page that has
 * none, and the rule under the words is what a paper form uses to say "write
 * here" anyway.
 *
 * The example in the field is set in italic, which the writer's own answer
 * never is. Nothing else separates a prompt from a short line someone typed,
 * and a reference the writer believes is stored is worse than an empty field.
 *
 * The ring is the register's own recipe rather than the standard one with a
 * colour appended, for the reason `deepFocusRingClass` gives.
 */
export const deepFieldClass = [
  'w-full border-deep-rule border-b bg-transparent pb-1',
  'text-deep-ink placeholder:text-deep-ink-muted placeholder:italic',
  'transition-colors duration-150 ease-standard',
  'hover:border-deep-ink-muted focus:border-deep-ink',
  deepFocusRingClass,
].join(' ');
