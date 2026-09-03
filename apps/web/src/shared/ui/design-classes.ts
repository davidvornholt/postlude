/**
 * The shape vocabulary every page shares: the page frame, the reading measure
 * inside it, the letterspaced eyebrow, and the focus ring. This file owns the
 * classes that build them so one page cannot drift by retyping them.
 *
 * These carry shape, and callers add the colour a state needs. The one colour
 * held here is the focus ring's, which is fixed because no caller re-colours it:
 * two utilities that set the same property are ordered by the generated
 * stylesheet, never by a `class` attribute, so a shared recipe can only hold a
 * colour that nothing downstream has to override.
 */

/**
 * Eyebrows are typed as sentence case and uppercased by CSS, so the words stay
 * readable in the source and in anything that reads the page aloud.
 */
export const eyebrowClass = 'text-xs uppercase tracking-widest';

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
 * The page frame: one width for every page and for the masthead above them, so
 * the brand, the navigation, and whatever a page opens with all start on the
 * same vertical line. It is set at the width the archive needs for a year of
 * days, because a frame that changed between pages would move the masthead
 * under the reader as they walked from one to the next.
 */
export const pageFrameClass = 'mx-auto w-full max-w-4xl px-5 sm:px-8';

/**
 * The measure text is read and written at: roughly 65 characters, which is a
 * comfortable line for a long evening entry and much shorter than the frame.
 * It sits at the left of the frame rather than centred in it, so a paragraph
 * begins on the same line as the heading above it.
 */
export const readingMeasureClass = 'max-w-prose';
