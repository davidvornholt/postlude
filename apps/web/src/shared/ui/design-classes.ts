/**
 * Small typography and focus utilities shared across unrelated elements.
 * Repeated controls and layout belong to components, including PageFrame. This file owns the
 * classes that build them so one page cannot drift by retyping them.
 *
 * These carry shape, and callers add the colour a state needs. The one colour
 * held here is the focus ring's, which is fixed because no caller re-colours it:
 * two utilities that set the same property are ordered by the generated
 * stylesheet, never by a `class` attribute, so a shared recipe can only hold a
 * colour that nothing downstream has to override.
 */

/**
 * The name of a part of a page, such as the morning or the end of the day: the
 * one step between the page's own title and the labels inside each part. It is
 * set well above both, so the parts of a long page can be told apart at a
 * glance without a rule between them.
 */
export const sectionHeadingClass = 'font-display text-2xl sm:text-3xl';

/**
 * A small label: a field's name, a note's source, a quiet action. It keeps the
 * sentence case it is written in, because a page where every label is set in
 * capitals makes each one shout at the same volume as the writing it frames.
 */
export const eyebrowClass = 'text-sm';

export const focusRingClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * The same ring for anything inside the deep register, as its own recipe
 * rather than a colour appended to the one above. The primary green sits at
 * 2.11:1 on the deep ground, under the 3:1 a focus indicator has to clear, and
 * appending `outline-deep-ink` to `focusRingClass` would not reliably replace
 * it: which of two utilities setting the same property wins is decided by their
 * order in the generated stylesheet and never by the `class` attribute. So the
 * register's controls carry this instead, and never both.
 */
export const deepFocusRingClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-ink';

/**
 * The measure text is read and written at: roughly 65 characters, which is a
 * comfortable line for a long evening entry and much shorter than the frame.
 * It sits at the left of the frame rather than centred in it, so a paragraph
 * begins on the same line as the heading above it.
 */
export const readingMeasureClass = 'max-w-prose';

/**
 * The frame of a segmented track (`segmented-control.tsx`), also for a form
 * that draws its segments itself.
 */
export const segmentTrackClass =
  'relative grid auto-cols-fr grid-flow-col border border-border p-1';

/**
 * A segment around a native radio laid invisibly over it, filled while that
 * radio is checked: the segmented track's look for a form that must work
 * before its script runs. The state comes from the radio itself, so the
 * segment is right with or without the script, and it stops inviting a press
 * while its fieldset is disabled. The chosen segment fills at once rather than
 * sliding.
 */
export const checkedSegmentClass = [
  'relative flex min-h-10 cursor-pointer items-center justify-center whitespace-nowrap px-3 text-ink-muted text-sm transition-colors duration-300 ease-standard motion-reduce:transition-none',
  'hover:text-ink has-checked:bg-ink has-checked:text-background has-checked:hover:text-background',
  'has-focus-visible:outline-2 has-focus-visible:outline-primary has-focus-visible:outline-offset-2',
  'has-disabled:cursor-default',
].join(' ');
