/**
 * One rating of the day, as three choices in a row.
 *
 * The choices are native radio buttons, so the arrow keys move between them
 * and a screen reader names the group and the choice, and each one wears its
 * label as a square target wide enough for a thumb. The chosen one is filled,
 * and its label stays the same words, so the choice never rests on colour
 * alone.
 */

import { useId } from 'react';

import { Button } from '#/shared/ui/action.tsx';

type RatingScaleProps<Value extends string> = {
  readonly legend: string;
  /** Said under the legend, such as that the rating is optional. */
  readonly hint?: string;
  readonly options: ReadonlyArray<{
    readonly value: Value;
    readonly label: string;
  }>;
  readonly value: Value | null;
  readonly onChange: (value: Value) => void;
  /** A closed day keeps its ratings on show without letting them change. */
  readonly disabled: boolean;
  /** Offered for an optional rating, so a choice made by mistake can be undone. */
  readonly clear?: { readonly label: string; readonly run: () => void };
};

const choiceClass = [
  'relative inline-flex min-h-11 min-w-24 flex-1 cursor-pointer select-none items-center justify-center px-4',
  'border border-border-strong text-ink',
  'transition-colors duration-150 ease-standard motion-reduce:transition-none',
  'hover:bg-surface-sunken',
  'has-[:checked]:z-10 has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary',
  'has-[:focus-visible]:z-20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
  'has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent',
  'has-[:disabled:not(:checked)]:text-ink-muted',
  'has-[:checked:disabled]:hover:bg-primary',
].join(' ');

export const RatingScale = <Value extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  disabled,
  clear,
}: RatingScaleProps<Value>) => {
  const nameId = useId();
  const hintId = useId();
  return (
    <fieldset
      aria-describedby={hint === undefined ? undefined : hintId}
      disabled={disabled}
    >
      <legend className="font-display text-ink text-xl">{legend}</legend>
      {hint === undefined ? null : (
        <p className="mt-1 text-ink-muted text-sm" id={hintId}>
          {hint}
        </p>
      )}
      <div className="mt-3 flex max-w-md -space-x-px">
        {options.map((option) => (
          <label className={choiceClass} key={option.value}>
            <input
              checked={value === option.value}
              className="sr-only appearance-none"
              name={nameId}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
      {clear === undefined || value === null || disabled ? null : (
        <Button className="mt-4" onClick={clear.run} variant="quiet">
          {clear.label}
        </Button>
      )}
    </fieldset>
  );
};
