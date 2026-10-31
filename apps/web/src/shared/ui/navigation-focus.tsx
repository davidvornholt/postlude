import { useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

type Place = { readonly pathname: string; readonly search: string };

const focusIsLost = (): boolean =>
  document.activeElement === null || document.activeElement === document.body;

/** A link that asked to be followed, and where it leads. */
type Armed = { readonly focusKey: string; readonly destination: string };

/**
 * The link a press was on, when it carries a focus key and the press is one
 * the router takes over. A press with a modifier opens a tab or a window
 * instead, and leaves this page where it was.
 */
const armedBy = (event: MouseEvent): Armed | undefined => {
  if (
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    !(event.target instanceof Element)
  ) {
    return;
  }
  const link = event.target.closest('a[data-focus-key]');
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }
  const focusKey = link.getAttribute('data-focus-key');
  if (focusKey === null) {
    return;
  }
  const { pathname, search } = new URL(link.href);
  return { destination: `${pathname}${search}`, focusKey };
};

const twinOf = (focusKey: string | undefined): HTMLElement | null =>
  focusKey === undefined
    ? null
    : document.querySelector<HTMLElement>(
        `[data-focus-key="${CSS.escape(focusKey)}"]`,
      );

/**
 * Moves focus for a navigation from one place to the next, and brings a new
 * page's top into view when its landmark is out of sight.
 */
const land = (
  previous: Place,
  current: Place,
  focusKey: string | undefined,
): void => {
  const pageChanged = previous.pathname !== current.pathname;
  const queryChanged = previous.search !== current.search;
  if (!(pageChanged || (queryChanged && focusIsLost()))) {
    return;
  }
  const main = document.querySelector('main');
  if (main === null) {
    return;
  }
  (twinOf(focusKey) ?? main).focus({ preventScroll: true });
  if (!pageChanged) {
    return;
  }
  const { bottom, top } = main.getBoundingClientRect();
  if (bottom <= 0 || top >= window.innerHeight || top < 0) {
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
  }
};

/**
 * Keep initial page-load focus, but announce client navigation through its new
 * landmark.
 *
 * A navigation that only changes the query keeps the same page, so focus stays
 * on the control that made it. That control can go away with the old state,
 * like a "Today" link on the page it leads to, and the browser then drops focus
 * to the document. Focus goes to the main landmark instead, so a keyboard
 * stays in the page rather than starting again from the top.
 *
 * A link can ask to be followed instead, by carrying a `data-focus-key`. A
 * navigation made by pressing it lands on the link with the same key on the
 * new page, when there is one, rather than on the landmark: stepping from day
 * to day keeps focus on the arrow that steps, so the next step is one more
 * press. Only that press counts. The browser's Back and Forward, or a key that
 * steps while focus happens to rest on such a link, still land on the
 * landmark, because nothing on the page made the move.
 */
export const NavigationFocus = () => {
  const router = useRouter();
  const location = useRouterState({
    select: (state) =>
      state.status === 'idle' ? state.resolvedLocation : undefined,
  });
  const previousRef = useRef<Place | undefined>(undefined);
  const focusKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // The press is seen before the link's own handler starts the navigation,
    // which then takes the key only if it is going where the link pointed.
    let armed: Armed | undefined;
    const arm = (event: MouseEvent) => {
      armed = armedBy(event);
    };
    document.addEventListener('click', arm, { capture: true });
    const stopListening = router.subscribe(
      'onBeforeNavigate',
      ({ toLocation }) => {
        focusKeyRef.current =
          armed?.destination === `${toLocation.pathname}${toLocation.searchStr}`
            ? armed.focusKey
            : undefined;
        armed = undefined;
      },
    );
    return () => {
      document.removeEventListener('click', arm, { capture: true });
      stopListening();
    };
  }, [router]);
  useEffect(() => {
    if (location === undefined) {
      return;
    }
    const previous = previousRef.current;
    const current = { pathname: location.pathname, search: location.searchStr };
    const focusKey = focusKeyRef.current;
    previousRef.current = current;
    focusKeyRef.current = undefined;
    if (previous === undefined) {
      return;
    }
    land(previous, current, focusKey);
  }, [location]);
  return null;
};
