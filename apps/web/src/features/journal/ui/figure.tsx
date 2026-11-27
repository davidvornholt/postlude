import type { ReactNode } from 'react';

// A figure, such as the minutes at the screen, set the same way wherever the
// journal shows one, in the day report and on Insights: a label over a
// number in the display serif, under a hairline. The page has no cards, so a
// figure is never boxed. It is one term of a <dl>, and its value and note
// are read together as its one description.
export const Figure = ({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: ReactNode;
}) => (
  <div className="border-border border-t pt-3">
    <dt className="text-ink-muted text-sm">{label}</dt>
    <dd className="mt-1">
      <span className="block font-display text-2xl text-ink tabular-nums">
        {value}
      </span>
      {note === undefined ? null : (
        <span className="mt-1 block text-ink-faint text-sm">{note}</span>
      )}
    </dd>
  </div>
);
