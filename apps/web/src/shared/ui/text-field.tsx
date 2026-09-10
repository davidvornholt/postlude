import type { ComponentProps } from 'react';

import { deepFocusRingClass, focusRingClass } from './design-classes.ts';

type TextFieldProps = ComponentProps<'input'> & {
  readonly tone?: 'default' | 'deep';
  readonly appearance?: 'underlined' | 'outlined';
};

const fieldAppearance = (
  appearance: 'underlined' | 'outlined',
  tone: 'default' | 'deep',
) => {
  if (appearance === 'outlined') {
    return `min-h-11 w-full border border-border bg-transparent px-3 ${focusRingClass}`;
  }
  const colors =
    tone === 'deep'
      ? `border-deep-rule text-deep-ink placeholder:text-deep-ink-muted hover:border-deep-ink-muted focus:border-deep-ink ${deepFocusRingClass}`
      : `border-border text-ink placeholder:text-ink-muted hover:border-ink-muted focus:border-ink ${focusRingClass}`;
  return `w-full border-b bg-transparent pb-1 transition-colors duration-150 ease-standard placeholder:italic ${colors}`;
};

export const TextField = ({
  tone = 'default',
  appearance = 'underlined',
  className = '',
  ...props
}: TextFieldProps) => (
  <input
    {...props}
    className={`${fieldAppearance(appearance, tone)} ${className}`}
  />
);
