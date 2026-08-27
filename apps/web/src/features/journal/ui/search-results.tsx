/**
 * The days a search found, newest first.
 *
 * Each result reads the way "on this day" does: the date as an eyebrow, then
 * the writer's own words, with the whole line the link. What is different is
 * that the words are cut from around the match rather than from the top of the
 * day, and the matched words are marked.
 *
 * The marks are `<mark>` elements rather than a colour on a span. A reader who
 * cannot see the tint still hears the element, and the words are set a weight
 * heavier as well, so nothing here is said by colour alone.
 */

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import type { ExcerptSegment } from '../search-query.ts';
import type { SearchHit } from '../services/search-fns.ts';
import { DayLink } from './day-link.tsx';

const linkClass = [
  'block border-border border-t py-5',
  'transition-colors duration-150 ease-standard hover:border-ink-muted',
  focusRingClass,
].join(' ');

const markClass = 'bg-accent-subtle font-medium text-ink';

const Excerpt = ({
  segments,
}: {
  readonly segments: ReadonlyArray<ExcerptSegment>;
}) => (
  <span className="mt-3 block min-w-0 max-w-prose break-words text-ink text-lg">
    {segments.map((segment) =>
      segment.match ? (
        <mark className={markClass} key={segment.at}>
          {segment.text}
        </mark>
      ) : (
        <span key={segment.at}>{segment.text}</span>
      ),
    )}
  </span>
);

type SearchResultsProps = {
  readonly hits: ReadonlyArray<SearchHit>;
  readonly today: JournalDate;
};

export const SearchResults = ({ hits, today }: SearchResultsProps) => (
  <div>
    {hits.map((hit) => (
      <DayLink
        className={linkClass}
        date={hit.date}
        key={hit.date}
        today={today}
      >
        <span className={[eyebrowClass, 'block text-ink-faint'].join(' ')}>
          {hit.fromScripture
            ? `${journalDateLabel(hit.date)} · Morning`
            : journalDateLabel(hit.date)}
        </span>
        <Excerpt segments={hit.excerpt} />
      </DayLink>
    ))}
  </div>
);
