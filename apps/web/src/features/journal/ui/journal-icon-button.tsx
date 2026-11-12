import type { LucideIcon } from 'lucide-react';
import { type ComponentProps, useId } from 'react';

import {
  deepFocusRingClass,
  focusRingClass,
} from '#/shared/ui/design-classes.ts';
import { useTip } from './use-tip.ts';

/** The ground a control is set on: the page, or the deep register's band. */
export type WritingTone = 'deep' | 'page';

type JournalIconButtonProps = ComponentProps<'button'> & {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly hint?: string;
  readonly inToolbar?: boolean;
  readonly divider?: boolean;
  readonly hintAlign?: 'start' | 'end';
  readonly tone?: WritingTone;
};

export const JournalIconButton = ({
  icon: Icon,
  label,
  hint,
  inToolbar = false,
  divider = false,
  hintAlign = 'start',
  tone = 'page',
  className = tone === 'deep' ? deepFocusRingClass : focusRingClass,
  onKeyDown,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  ...props
}: JournalIconButtonProps) => {
  const hintId = useId();
  const tip = useTip();
  return (
    <span
      className={[
        'relative inline-flex min-w-0',
        inToolbar ? 'max-w-11 flex-1' : 'w-11 shrink-0',
        divider
          ? `ml-1.5 box-content border-l pl-1.5 ${tone === 'deep' ? 'border-deep-rule' : 'border-border'}`
          : '',
      ].join(' ')}
      ref={tip.holderRef}
      {...tip.holderHandlers}
    >
      <button
        {...props}
        aria-describedby={hintId}
        aria-label={label}
        className={[
          'relative inline-flex h-11 w-full min-w-8 cursor-pointer items-center justify-center transition-colors duration-150 ease-standard motion-reduce:transition-none',
          // Pressed is a state, not a verdict, so it is drawn in the text's own
          // colour on either ground rather than in the green that says "good".
          'enabled:hover:bg-current/10 disabled:cursor-default disabled:opacity-40 aria-pressed:bg-current/15',
          'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-current after:opacity-0 after:transition-opacity aria-pressed:after:opacity-100 motion-reduce:after:transition-none',
          className,
        ].join(' ')}
        onBlur={(event) => {
          tip.controlHandlers.onBlur();
          onBlur?.(event);
        }}
        onFocus={(event) => {
          tip.controlHandlers.onFocus(event);
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          tip.controlHandlers.onKeyDown(event);
          onKeyDown?.(event);
        }}
        onPointerDown={(event) => {
          tip.controlHandlers.onPointerDown(event);
          onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          tip.controlHandlers.onPointerUp(event);
          onPointerUp?.(event);
        }}
        type="button"
      >
        <Icon />
      </button>
      <span
        className={[
          'absolute top-full z-40 flex w-max max-w-48 flex-col gap-0.5 bg-ink px-3 py-2 text-background text-xs leading-normal',
          hintAlign === 'end' ? 'right-0' : 'left-0',
          tip.shown ? 'visible' : 'invisible',
        ].join(' ')}
        id={hintId}
        role="tooltip"
      >
        {label}
        {hint ? <span className="opacity-75">{hint}</span> : null}
      </span>
    </span>
  );
};
