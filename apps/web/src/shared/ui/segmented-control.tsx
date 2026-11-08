/**
 * A short row of choices of which exactly one holds: drawn as one track, with a
 * thumb that slides to the chosen segment.
 *
 * Every segment takes the same share of a track whose width does not depend on
 * the choice, so choosing never moves anything beside the control — which is
 * exactly what a label that changes its width does to the buttons next to it.
 * The thumb slides rather than jumps so the eye follows the choice from where
 * it was to where it is; a reader who asks for less motion gets the jump.
 *
 * Two kinds of segment share the track. A link segment (`SegmentLink`) goes
 * somewhere and says which one is current, for a choice that belongs in the
 * address; a radio segment changes something on the page, for a choice that
 * does not.
 *
 * A form that must work before its script runs draws the same track from its
 * radios' own checked state instead, with `checkedSegmentClass`.
 */

import type { ComponentProps, ReactNode } from 'react';

import { focusRingClass, segmentTrackClass } from './design-classes.ts';

/** A track holds two to four segments; past that it stops reading as one choice. */
export type SegmentCount = 2 | 3 | 4;

// Written out in full so the stylesheet generator can find each class.
const thumbWidths: Record<SegmentCount, string> = {
  2: 'w-[calc((100%-0.5rem)/2)]',
  3: 'w-[calc((100%-0.5rem)/3)]',
  4: 'w-[calc((100%-0.5rem)/4)]',
};

const thumbOffsets: ReadonlyArray<string> = [
  'translate-x-0',
  'translate-x-full',
  'translate-x-[200%]',
  'translate-x-[300%]',
];

const segmentClass = (selected: boolean): string =>
  [
    'relative z-10 flex min-h-10 items-center justify-center whitespace-nowrap px-3 text-sm transition-colors duration-300 ease-standard motion-reduce:transition-none',
    selected ? 'text-background' : 'text-ink-muted hover:text-ink',
  ].join(' ');

type SegmentedTrackProps = {
  readonly count: SegmentCount;
  /** The chosen segment's position, or -1 while none is. */
  readonly selected: number;
  readonly children: ReactNode;
  readonly className?: string;
};

export const SegmentedTrack = ({
  count,
  selected,
  children,
  className = '',
}: SegmentedTrackProps) => (
  <div className={[segmentTrackClass, className].join(' ')}>
    <span
      aria-hidden="true"
      className={[
        'absolute inset-y-1 left-1 bg-ink transition-[translate,opacity] duration-300 ease-standard motion-reduce:transition-none',
        thumbWidths[count],
        thumbOffsets[Math.max(selected, 0)] ?? '',
        selected < 0 ? 'opacity-0' : '',
      ].join(' ')}
    />
    {children}
  </div>
);

type SegmentAnchorProps = ComponentProps<'a'> & {
  readonly selected: boolean;
  readonly 'data-status'?: string;
};

/**
 * A segment that navigates, for `SegmentLink`. It marks itself current from
 * `selected` alone, because every segment points at the same page and the
 * router would call each of them current.
 */
export const SegmentAnchor = ({
  selected,
  'aria-current': _ariaCurrent,
  'data-status': _dataStatus,
  className = '',
  ...props
}: SegmentAnchorProps) => (
  <a
    {...props}
    aria-current={selected ? 'page' : undefined}
    className={[segmentClass(selected), focusRingClass, className].join(' ')}
  />
);

type SegmentRadioProps = {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly children: ReactNode;
};

/** A segment that chooses something on the page, as a native radio button. */
export const SegmentRadio = ({
  name,
  value,
  checked,
  onChange,
  children,
}: SegmentRadioProps) => (
  <label
    className={[
      segmentClass(checked),
      'cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-primary has-focus-visible:outline-offset-2',
    ].join(' ')}
  >
    <input
      checked={checked}
      className="sr-only"
      name={name}
      onChange={onChange}
      type="radio"
      value={value}
    />
    {children}
  </label>
);
