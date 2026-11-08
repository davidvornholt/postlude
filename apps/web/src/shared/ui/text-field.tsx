import type { ComponentProps, KeyboardEvent } from 'react';

import { deepFocusRingClass, focusRingClass } from './design-classes.ts';
import { asOneLine } from './one-line.ts';

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

type WrappingTextFieldProps = Omit<
  ComponentProps<'textarea'>,
  'className' | 'onChange' | 'rows' | 'value'
> & {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly tone?: 'default' | 'deep';
  /** Sizes and places the field; its type is inherited by the text inside. */
  readonly className?: string;
};

/**
 * A one-line text field whose line wraps and grows downward once it is longer
 * than the field is wide, rather than scrolling out of sight sideways.
 *
 * It is still one paragraph. Enter leaves the field instead of starting a new
 * line, and a line break that is pasted or dropped in becomes a space, with the
 * caret kept where the text was put.
 *
 * The height comes from CSS rather than from measuring: an invisible copy of
 * the text, or of the placeholder while the field is empty, sits in the same
 * grid cell with the same type, padding, and wrapping, and the field stretches
 * to the copy's height. So the server's markup already has the height the text
 * needs, and nothing moves when the page hydrates.
 */
export const WrappingTextField = ({
  value,
  onValueChange,
  tone = 'default',
  className = '',
  placeholder,
  onKeyDown,
  ...props
}: WrappingTextFieldProps) => {
  const leaveOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    // Enter while an input method is composing a character confirms that
    // character, so it is left to the input method.
    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.blur();
  };
  // What the invisible copy holds, so the field is as tall as what it shows.
  const shown = value === '' ? (placeholder ?? '') : value;

  return (
    <div className={`grid grid-cols-1 ${className}`}>
      <span
        aria-hidden="true"
        className={[
          'invisible col-start-1 row-start-1 whitespace-pre-wrap break-words border-b pb-1',
          value === '' ? 'italic' : '',
        ].join(' ')}
      >
        {shown}
      </span>
      <textarea
        {...props}
        className={`col-start-1 row-start-1 block resize-none self-stretch overflow-hidden ${fieldAppearance('underlined', tone)}`}
        enterKeyHint="done"
        onChange={(event) => {
          const field = event.currentTarget;
          const line = asOneLine(field.value);
          if (line !== field.value) {
            // Set here, before React renders it, so the caret stays after the
            // text that was put in instead of jumping to the end.
            const caret = asOneLine(
              field.value.slice(0, field.selectionStart),
            ).length;
            field.value = line;
            field.setSelectionRange(caret, caret);
          }
          onValueChange(line);
        }}
        onKeyDown={leaveOnEnter}
        placeholder={placeholder}
        rows={1}
        value={value}
      />
    </div>
  );
};
