/**
 * Which books the mornings were spent in, most-read first. Each count is
 * written beside its bar, as the screen-time categories are, so the bar is
 * there to compare lengths and nothing has to be read off it.
 */

import type { BookCount } from '../insights-patterns.ts';
import { journalCountLabel } from '../journal-labels.ts';

const barScale = 100;
/** Past this many the list stops being a picture and becomes an index. */
const shownBooks = 8;

export const ScriptureBooks = ({
  books,
}: {
  readonly books: ReadonlyArray<BookCount>;
}) => {
  const shown = books.slice(0, shownBooks);
  const rest = books.length - shown.length;
  const most = Math.max(1, ...shown.map((book) => book.mornings));
  return (
    <>
      <ul aria-label="Mornings by book" className="grid gap-3">
        {shown.map((book) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
            key={book.book}
          >
            <span className="truncate text-ink">{book.book}</span>
            <svg
              aria-hidden="true"
              className="col-span-2 row-start-2 block h-3 w-full sm:col-span-1 sm:col-start-2 sm:row-start-1"
              preserveAspectRatio="none"
              viewBox={`0 0 ${barScale} 1`}
            >
              <rect
                className="fill-primary"
                height={1}
                width={(book.mornings / most) * barScale}
                x={0}
                y={0}
              />
            </svg>
            <span className="col-start-2 row-start-1 text-right text-ink-muted tabular-nums sm:col-start-3">
              {journalCountLabel(book.mornings, 'morning')}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <p className="mt-4 text-ink-faint text-sm">
          {`And ${journalCountLabel(rest, 'other book')}.`}
        </p>
      ) : null}
    </>
  );
};
