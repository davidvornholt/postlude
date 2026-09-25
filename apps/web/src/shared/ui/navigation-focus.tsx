import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/** Keep initial page-load focus, but announce client navigation through its new landmark. */
export const NavigationFocus = () => {
  const pathname = useRouterState({
    select: (state) =>
      state.status === 'idle' ? state.resolvedLocation?.pathname : undefined,
  });
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname === undefined) {
      return;
    }
    const previous = previousPathRef.current;
    previousPathRef.current = pathname;
    if (previous === undefined || previous === pathname) {
      return;
    }
    const main = document.querySelector('main');
    if (main === null) {
      return;
    }
    main.focus({ preventScroll: true });
    const { bottom, top } = main.getBoundingClientRect();
    if (bottom <= 0 || top >= window.innerHeight || top < 0) {
      window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
    }
  }, [pathname]);
  return null;
};
