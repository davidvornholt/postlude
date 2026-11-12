/**
 * When a control's tip shows: while a pointer rests on the control, on a
 * screen whose pointer can hover as Tailwind's `hover:` asks, while it has
 * focus from the keyboard (`:focus-visible`), and after a tap on a touch
 * screen until the next one.
 *
 * It goes when the pointer leaves, on Escape, on a press or tap anywhere
 * else, and on scroll (WCAG 1.4.13). A mouse press hides it until the
 * pointer comes back, so a click never leaves a tip standing over the page.
 * Scrolling leaves a tip that keyboard focus showed, since moving focus may
 * scroll the control into view.
 */

import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type ShownBy = 'pointer' | 'touch' | 'keyboard';

const canHover = (): boolean => matchMedia('(hover: hover)').matches;

/** Closes a shown tip on a press outside it, on Escape, and on scroll. */
const useTipDismissal = (
  shownBy: ShownBy | undefined,
  hide: () => void,
  holderRef: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    if (shownBy === undefined) {
      return;
    }
    const outside = (event: globalThis.PointerEvent): void => {
      if (!holderRef.current?.contains(event.target as Node | null)) {
        hide();
      }
    };
    const onEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        hide();
      }
    };
    const onScroll = (): void => {
      if (shownBy !== 'keyboard') {
        hide();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', onEscape);
    document.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [shownBy, hide, holderRef]);
};

export const useTip = () => {
  const [shownBy, setShownBy] = useState<ShownBy>();
  /** A mouse pressed the control, and its pointer hasn't left since. */
  const pressedRef = useRef(false);
  const holderRef = useRef<HTMLSpanElement>(null);
  const hide = useCallback(() => setShownBy(undefined), []);
  useTipDismissal(shownBy, hide, holderRef);

  const holderHandlers = {
    onPointerEnter: (event: PointerEvent): void => {
      if (event.pointerType !== 'touch' && !pressedRef.current && canHover()) {
        setShownBy('pointer');
      }
    },
    onPointerLeave: (event: PointerEvent): void => {
      if (event.pointerType === 'touch') {
        return;
      }
      pressedRef.current = false;
      setShownBy((current) => (current === 'pointer' ? undefined : current));
    },
  };

  const controlHandlers = {
    onPointerDown: (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') {
        pressedRef.current = true;
        hide();
      }
    },
    onPointerUp: (event: PointerEvent): void => {
      if (event.pointerType === 'touch') {
        setShownBy((current) => (current === 'touch' ? undefined : 'touch'));
      }
    },
    onFocus: (event: FocusEvent<HTMLElement>): void => {
      if (event.currentTarget.matches(':focus-visible')) {
        setShownBy('keyboard');
      }
    },
    onBlur: (): void => {
      setShownBy((current) => (current === 'pointer' ? current : undefined));
    },
    onKeyDown: (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        hide();
      }
    },
  };

  return {
    shown: shownBy !== undefined,
    holderRef,
    holderHandlers,
    controlHandlers,
  };
};
