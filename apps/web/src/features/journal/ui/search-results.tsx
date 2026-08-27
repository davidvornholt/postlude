/**
 * The days a search found, newest first.
 *
 * Each result reads the way "on this day" does: the date as an eyebrow, then
 * the attributed lines that explain the match. A query can span the evening,
 * morning notes, and passage reference, so a result never hides the source
 * that contributed one of its terms.
 *
 * The marks are `<mark>` elements rather than a colour on a span. A reader who
 * cannot see the tint still hears the element, and the words are set a weight
 * heavier as well, so nothing here is said by colour alone.
 */

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import type { SearchHitSource } from '../search-contract.ts';
import type { ExcerptSegment } from '../search-excerpt.ts';
import type { SearchHit } from '../services/search-fns.ts';
import { DayLink } from './day-link.tsx';

const linkClass = [
  'block border-border border-t py-5',
  'transition-colors duration-150 ease-standard hover:border-ink-muted',
  focusRingClass,
].join(' ');

const markClass = 'bg-accent-subtle font-medium text-ink';

const sourceLabels = {
  evening: 'Evening',
  'passage-reference': 'Passage reference',
  'scripture-notes': 'Morning notes',
} as const;

const excerptKey = (segments: ReadonlyArray<ExcerptSegment>): string =>
  segments.map(({ match, text }) => `${match ? '1' : '0'}:${text}`).join();

const Excerpt = ({
  segments,
}: {
  readonly segments: ReadonlyArray<ExcerptSegment>;
}) => (
  <span className="mt-2 block min-w-0 max-w-prose break-words text-ink text-lg">
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

const SourceEvidence = ({ source }: { readonly source: SearchHitSource }) => (
  <span className="mt-4 block">
    <span className={[eyebrowClass, 'block text-ink-faint'].join(' ')}>
      {sourceLabels[source.kind]}
    </span>
    {source.excerpts.map((excerpt) => (
      <Excerpt key={excerptKey(excerpt)} segments={excerpt} />
    ))}
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
          {journalDateLabel(hit.date)}
        </span>
        {hit.sources.map((source) => (
          <SourceEvidence key={source.kind} source={source} />
        ))}
      </DayLink>
    ))}
  </div>
);
