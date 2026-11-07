/**
 * Content that opens by growing to its height and closes by shrinking away,
 * so what follows it on the page moves along with it instead of jumping.
 *
 * The height comes from a grid row that goes from `0fr` to `1fr`, which every
 * current browser can transition, so nothing is measured and the server's
 * markup is already the right height. Closed, the content is invisible and
 * inert: out of the tab order and the accessibility tree, as folded content
 * should be. It clips what overflows it only while it moves or stays closed, so
 * once it is open a focus ring at its edge is drawn whole. With reduced motion
 * it opens and closes at once.
 *
 * Content that has to start afresh each time it opens, such as a frame that
 * loads a document, can leave the page once it has finished closing. It starts
 * afresh even when it is opened again before it has finished closing.
 */

import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

type CollapsibleProps = {
  readonly open: boolean;
  readonly children: ReactNode;
  readonly id?: string;
  /** A span, for content inside an element that takes only phrasing content, such as a button. */
  readonly as?: 'div' | 'span';
  readonly className?: string;
  /** Takes the content off the page once it has closed, and back on as it opens. */
  readonly unmountWhenClosed?: boolean;
};

/**
 * Whether the content has finished moving to where `open` puts it, and how
 * many times it has opened. Both are held with the `open` they belong to, so a
 * change of direction is unsettled from the very render that makes it, before
 * any effect has run.
 */
const useSettled = (
  open: boolean,
): {
  readonly settled: boolean;
  readonly openings: number;
  readonly attach: (element: HTMLElement | null) => void;
} => {
  const elementRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState({ open, openings: 0, settled: true });
  if (state.open !== open) {
    setState({
      open,
      openings: state.openings + (open ? 1 : 0),
      settled: false,
    });
  }
  const moving = !state.settled;

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!moving || element === null) {
      return;
    }
    let current = true;
    // Reading the element's animations brings its style up to date first, so
    // the transitions this change started are among them. With none running,
    // as with reduced motion, it settles at once.
    Promise.all(element.getAnimations().map(({ finished }) => finished)).then(
      () => {
        if (current) {
          // Only the direction it was waiting for settles it.
          setState((settling) =>
            settling.open === open ? { ...settling, settled: true } : settling,
          );
        }
      },
      // A transition is cancelled when the direction changes before it ends,
      // and the effect for the new direction waits for its own.
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [moving, open]);

  const attach = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);
  return { attach, openings: state.openings, settled: !moving };
};

export const Collapsible = ({
  open,
  children,
  id,
  as: Tag = 'div',
  className = '',
  unmountWhenClosed = false,
}: CollapsibleProps) => {
  const { attach, openings, settled } = useSettled(open);
  const mounted = !unmountWhenClosed || open || !settled;
  return (
    <Tag
      className={[
        'grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-standard motion-reduce:transition-none',
        open
          ? 'grid-rows-[1fr] opacity-100'
          : 'invisible grid-rows-[0fr] opacity-0',
        className,
      ].join(' ')}
      id={id}
      inert={!open}
      ref={attach}
    >
      <Tag
        className={['min-h-0', open && settled ? '' : 'overflow-hidden'].join(
          ' ',
        )}
        // Each opening is a new piece of content when it is to start afresh.
        key={unmountWhenClosed ? openings : 0}
      >
        {mounted ? children : null}
      </Tag>
    </Tag>
  );
};
