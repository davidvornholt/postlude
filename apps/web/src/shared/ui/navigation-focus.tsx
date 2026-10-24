import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

type Place = { readonly pathname: string; readonly search: string };

const focusIsLost = (): boolean =>
  document.activeElement === null || document.activeElement === document.body;

/**
 * Keep initial page-load focus, but announce client navigation through its new
 * landmark.
 *
 * A navigation that only changes the query keeps the same page, so focus stays
 * on the control that made it. That control can go away with the old state,
 * like a "Today" link on the page it leads to, and the browser then drops focus
 * to the document. Focus goes to the main landmark instead, so a keyboard
 * stays in the page rather than starting again from the top.
 */
export const NavigationFocus = () => {
  const location = useRouterState({
    select: (state) =>
      state.status === 'idle' ? state.resolvedLocation : undefined,
  });
  const previousRef = useRef<Place | undefined>(undefined);
  useEffect(() => {
    if (location === undefined) {
      return;
    }
    const previous = previousRef.current;
    const current = { pathname: location.pathname, search: location.searchStr };
    previousRef.current = current;
    if (previous === undefined) {
      return;
    }
    const pageChanged = previous.pathname !== current.pathname;
    const queryChanged = previous.search !== current.search;
    if (!(pageChanged || (queryChanged && focusIsLost()))) {
      return;
    }
    const main = document.querySelector('main');
    if (main === null) {
      return;
    }
    main.focus({ preventScroll: true });
    if (!pageChanged) {
      return;
    }
    const { bottom, top } = main.getBoundingClientRect();
    if (bottom <= 0 || top >= window.innerHeight || top < 0) {
      window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
    }
  }, [location]);
  return null;
};
