/**
 * How much was written, while it is being written.
 *
 * The number is the writer's own, not a target: nothing here says whether it is
 * enough. It is counted from the markdown by the same code the server counts
 * with, so the figure under the editor is the figure the archive will shade the
 * day by, and it does not change when the save lands.
 *
 * Counting on every keystroke is cheap enough at journal length — a long entry
 * is a few thousand characters — but it is memoised anyway, because the page
 * re-renders on each save-status change too and there is no reason to recount
 * text that has not moved.
 */

import { useMemo } from 'react';
import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { countJournalCharacters, countJournalWords } from '../word-count.ts';

const one = 1;

/**
 * The line is assembled here rather than out of several JSX children, so it
 * reaches the page as one run of text. React writes a separator node between
 * adjacent children, and a count read aloud as "3", "words" is being read as
 * two things when it is one.
 */
const counted = (count: number, unit: string): string =>
  `${count} ${unit}${count === one ? '' : 's'}`;

type EntryCountsProps = {
  readonly markdown: string;
};

export const EntryCounts = ({ markdown }: EntryCountsProps) => {
  const line = useMemo(
    () =>
      `${counted(countJournalWords(markdown), 'word')} · ${counted(
        countJournalCharacters(markdown),
        'character',
      )}`,
    [markdown],
  );

  return <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>{line}</p>;
};
