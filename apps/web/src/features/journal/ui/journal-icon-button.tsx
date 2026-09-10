import { type ComponentProps, useState } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { JournalIcon, type JournalIconName } from './journal-icons.tsx';

type JournalIconButtonProps = ComponentProps<'button'> & {
  readonly icon: JournalIconName;
  readonly label: string;
  readonly hint?: string;
};

export const JournalIconButton = ({
  icon,
  label,
  hint,
  className = focusRingClass,
  onKeyDown,
  ...props
}: JournalIconButtonProps) => {
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className="journal-icon-control"
      data-hint-dismissed={dismissed || undefined}
      onPointerLeave={() => setDismissed(false)}
    >
      <button
        {...props}
        aria-label={label}
        className={`journal-icon-button ${className}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDismissed(true);
          }
          onKeyDown?.(event);
        }}
        type="button"
      >
        <JournalIcon name={icon} />
      </button>
      <span aria-hidden="true" className="journal-icon-hint">
        {label}
        {hint ? <span className="opacity-75">{hint}</span> : null}
      </span>
    </span>
  );
};
