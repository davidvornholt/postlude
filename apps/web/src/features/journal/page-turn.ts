/**
 * How the page answers a step to another day or month: the frame, the header
 * and the controls stay where they are, and only what changed fades across.
 * Nothing slides, so a reader stepping through the days watches the words
 * change rather than the page move.
 *
 * It rides on the router's view transition, and the stylesheet sets its
 * timing. A reader who asks the system for less motion gets no transition at
 * all, and the stylesheet keeps any that a browser starts anyway still.
 */

export type PageTurn = {
  readonly types: () => Array<string> | false;
};

const asksForLessMotion = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const pageTurn: PageTurn = {
  types: () => (asksForLessMotion() ? false : ['page-turn']),
};
