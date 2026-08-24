/**
 * The few class recipes the heirloom pages share.
 *
 * They hold the theme's constants — square corners, hairline borders, warm
 * shadows, small letterspaced labels — in one place, so a page cannot drift
 * from the others by retyping them. Colours are semantic utilities only: the
 * `.theme-heirloom` wrapper decides what warm cream and forest green are.
 */

/**
 * Labels are typed as sentence case and uppercased by CSS, so the words stay
 * readable in the source and in anything that reads the page aloud.
 */
export const labelClass = 'text-ink-faint text-xs uppercase tracking-widest';

export const focusRingClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const cardClass = 'border border-border bg-surface shadow-card';

/** The one card that carries the day itself sits a little further forward. */
export const featuredCardClass =
  'border border-border bg-surface shadow-featured';

export const displayHeadingClass = 'font-display text-ink tracking-tight';
