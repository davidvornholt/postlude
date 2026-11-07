/**
 * One rating of the day, as a row: its name, then three choices side by side.
 *
 * The choices are native radio buttons, so the arrow keys move between them
 * and a screen reader names the group and the choice, and each one wears its
 * label as a square target wide enough for a thumb. The chosen one is set in
 * ink, the page's own colour, rather than in a colour that would judge it:
 * "Drained" is not a failure, and green would say it was the good answer.
 * Its label stays the same words, so the choice never rests on colour alone.
 *
 * An optional rating is cleared by choosing its answer again, with a press or
 * with Space, so undoing a choice adds no control that appears and moves the
 * page under the pointer. The cleared answer is a radio button that is no
 * longer checked, which is what a screen reader then says about it.
 */

import { type ReactNode, useId } from 'react';

type RatingScaleProps<Value extends string> = {
  readonly legend: string;
  /** Said under the choices, such as that the rating is optional. */
  readonly hint?: string;
  readonly options: ReadonlyArray<{
    readonly value: Value;
    readonly label: string;
  }>;
  readonly value: Value | null;
  readonly onChange: (value: Value) => void;
  /** A closed day keeps its ratings on show without letting them change. */
  readonly disabled: boolean;
  /** Given for an optional rating: choosing the chosen answer clears it. */
  readonly onClear?: () => void;
};

const choiceClass = [
  'relative inline-flex min-h-11 min-w-0 flex-1 cursor-pointer select-none items-center justify-center px-3',
  'border border-border-strong text-ink',
  'transition-colors duration-200 ease-standard motion-reduce:transition-none',
  'hover:bg-surface-sunken',
  'has-[:checked]:z-10 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-background',
  'has-[:focus-visible]:z-20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
  'has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent',
  'has-[:disabled:not(:checked)]:text-ink-muted',
  'has-[:checked:disabled]:hover:bg-ink',
].join(' ');

/**
 * The name a row of the end of the day stands under on a phone and beside on
 * a wider screen, in a column as wide for every row so their choices line up.
 * Beside the choices, its first line sits level with theirs, and a name long
 * enough to wrap keeps its lines close rather than spread to the row's height.
 * It floats so a fieldset's legend can take the column too, which is why what
 * follows it clears it on a phone: a row of its own beside a float as wide as
 * the screen would otherwise be squeezed in next to it, past the edge.
 */
export const RowLabel = ({
  as: Tag,
  id,
  children,
}: {
  readonly as: 'h3' | 'legend';
  readonly id?: string;
  readonly children: ReactNode;
}) => (
  <Tag
    className="float-left w-full pb-2 text-ink sm:w-44 sm:py-2.5 sm:pr-4 sm:leading-6"
    id={id}
  >
    {children}
  </Tag>
);

export const RatingScale = <Value extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  disabled,
  onClear,
}: RatingScaleProps<Value>) => {
  const nameId = useId();
  const hintId = useId();
  return (
    <fieldset
      aria-describedby={hint === undefined ? undefined : hintId}
      className="flow-root py-3"
      disabled={disabled}
    >
      <RowLabel as="legend">{legend}</RowLabel>
      <div className="clear-left flex max-w-md -space-x-px sm:clear-none">
        {options.map((option) => (
          <label className={choiceClass} key={option.value}>
            <input
              checked={value === option.value}
              className="sr-only appearance-none"
              name={nameId}
              onChange={() => onChange(option.value)}
              // A press on the chosen answer changes nothing a radio button
              // reports, so it is caught as a press instead.
              onClick={() => {
                if (value === option.value) {
                  onClear?.();
                }
              }}
              // Chromium and WebKit send no press when Space lands on a
              // checked radio button, so Space on the chosen answer clears it
              // here. The key's default is cancelled so that a browser which
              // would press it as well cannot choose the answer again, and a
              // held key's repeats are cancelled for the same reason: any of
              // them would choose the just-cleared answer when the key is let go.
              onKeyDown={(event) => {
                if (event.key !== ' ' || onClear === undefined) {
                  return;
                }
                if (event.repeat) {
                  event.preventDefault();
                } else if (value === option.value) {
                  event.preventDefault();
                  onClear();
                }
              }}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint === undefined ? null : (
        <p className="mt-2 text-ink-muted text-sm sm:ml-44" id={hintId}>
          {hint}
        </p>
      )}
    </fieldset>
  );
};
