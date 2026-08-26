/**
 * The shape vocabulary every page shares: the set column, the letterspaced
 * eyebrow, the focus ring. `DESIGN.md` says what each one is for; this file is
 * where the classes that build them live, so one page cannot drift from another
 * by retyping them.
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
 * The set column the writing page keeps to: roughly 65 characters of Inter
 * once the gutters are taken off, which is a comfortable measure to read a
 * long evening entry at.
 */
export const columnClass = 'mx-auto w-full max-w-2xl px-5 sm:px-8';

/** The archive needs the year of days to fit, so it sets a wider measure. */
export const wideColumnClass = 'mx-auto w-full max-w-4xl px-5 sm:px-8';
