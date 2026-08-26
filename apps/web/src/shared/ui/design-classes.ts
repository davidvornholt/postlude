/**
 * The shape vocabulary every page shares: the set column, the letterspaced
 * eyebrow, the rule a section opens on, the focus ring, the deep register's
 * ground. `DESIGN.md` says what each one is for; this file is where the classes
 * that build them live, so one page cannot drift from another by retyping them.
 *
 * None of them carries a colour. Two utilities that set the same property have
 * no reliable winner from the order they appear in a `class` attribute, so a
 * colour left in a shared recipe would fight the one a caller adds for a state
 * or for the deep register. Callers pass the colour; these carry the shape.
 */

/**
 * Eyebrows are typed as sentence case and uppercased by CSS, so the words stay
 * readable in the source and in anything that reads the page aloud.
 */
export const eyebrowClass = 'text-xs uppercase tracking-widest';

/** The rule an eyebrow sits on: how a section opens everywhere in this design. */
export const ruledEyebrowClass = `${eyebrowClass} block border-b pb-3`;

export const focusRingClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** The same ring, in the deep register's own ink so it stays visible there. */
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

/**
 * The deep register: the single inverse surface. It runs the full width of the
 * viewport with its own column inside, because an inset dark panel reads as a
 * card and an edge-to-edge one reads as turning a page.
 */
export const deepRegisterClass = 'bg-deep-ground text-deep-ink';

/** Sections fade and rise as the reader reaches them; the CSS is in the theme. */
export const enterClass = 'pl-enter';
