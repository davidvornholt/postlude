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
 * The thumb and the chosen segment's colour are read from the segments
 * themselves, the link marked current or the radio that is checked, rather
 * than from a prop. A form that has to work before its script runs then
 * slides the same thumb from the radio a reader presses.
 */

import type { ComponentProps, ReactNode } from 'react';

import { focusRingClass } from './design-classes.ts';

/** A track holds two to four segments; past that it stops reading as one choice. */
export type SegmentCount = 2 | 3 | 4;

// Written out in full so the stylesheet generator can find each class.
const thumbWidths: Record<SegmentCount, string> = {
  2: 'w-[calc((100%-0.5rem)/2)]',
  3: 'w-[calc((100%-0.5rem)/3)]',
  4: 'w-[calc((100%-0.5rem)/4)]',
};

/*
 * Where the thumb stands, from whichever segment is on: the link to the current
 * page, or the label whose radio is checked. The thumb is the track's first
 * child, so the segments count from the second. With no segment on, the thumb
 * fades out. Written out in full so the stylesheet generator can find each
 * class.
 */
const thumbPlacementClass = [
  '[--segment-thumb-offset:0%] [--segment-thumb-opacity:1]',
  'has-[>:nth-child(3)[aria-current=page],>:nth-child(3)>:checked]:[--segment-thumb-offset:100%]',
  'has-[>:nth-child(4)[aria-current=page],>:nth-child(4)>:checked]:[--segment-thumb-offset:200%]',
  'has-[>:nth-child(5)[aria-current=page],>:nth-child(5)>:checked]:[--segment-thumb-offset:300%]',
  'not-has-[>[aria-current=page],>*>:checked]:[--segment-thumb-opacity:0]',
].join(' ');

const segmentClass =
  'relative z-10 flex min-h-10 items-center justify-center whitespace-nowrap px-3 text-sm transition-colors duration-300 ease-standard motion-reduce:transition-none';

type SegmentedTrackProps = {
  readonly count: SegmentCount;
  readonly children: ReactNode;
  readonly className?: string;
};

export const SegmentedTrack = ({
  count,
  children,
  className = '',
}: SegmentedTrackProps) => (
  <div
    className={[
      'relative grid auto-cols-fr grid-flow-col border border-border p-1',
      thumbPlacementClass,
      className,
    ].join(' ')}
  >
    <span
      aria-hidden="true"
      className={[
        'absolute inset-y-1 left-1 translate-x-(--segment-thumb-offset) bg-ink opacity-(--segment-thumb-opacity) transition-[translate,opacity] duration-300 ease-standard motion-reduce:transition-none',
        thumbWidths[count],
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
    className={[
      segmentClass,
      selected ? 'text-background' : 'text-ink-muted hover:text-ink',
      focusRingClass,
      className,
    ].join(' ')}
  />
);

type SegmentRadioProps = {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly children: ReactNode;
  readonly id?: string;
  readonly 'aria-describedby'?: string;
};

/**
 * A segment that chooses something on the page, as a native radio button laid
 * invisibly over the whole segment, so a press anywhere on it is a press on
 * the radio. Its colour follows the radio's own checked state, so it is right
 * before the script runs too, and it stops inviting a press while its
 * fieldset is disabled.
 */
export const SegmentRadio = ({
  name,
  value,
  checked,
  onChange,
  children,
  id,
  'aria-describedby': describedBy,
}: SegmentRadioProps) => (
  <label
    className={[
      segmentClass,
      'cursor-pointer text-ink-muted hover:text-ink has-disabled:cursor-default has-checked:text-background has-checked:hover:text-background',
      'has-focus-visible:outline-2 has-focus-visible:outline-primary has-focus-visible:outline-offset-2',
    ].join(' ')}
  >
    <input
      aria-describedby={describedBy}
      checked={checked}
      className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-default"
      id={id}
      name={name}
      onChange={onChange}
      type="radio"
      value={value}
    />
    {children}
  </label>
);
