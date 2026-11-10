/**
 * The days a search found.
 *
 * Each result reads the way "on this day" does: the date as an eyebrow, then
 * the attributed lines that explain the match. A query can span the evening,
 * morning notes, passage reference, and the report /wrap wrote, so a result
 * never hides the source that contributed one of its terms.
 *
 * The report is the agent's account of the day, not David's words, so it is
 * labelled and set apart from them.
 *
 * The marks are `<mark>` elements rather than a colour on a span. A reader who
 * cannot see the tint still hears the element, and the words are set a weight
 * heavier as well, so nothing here is said by colour alone.
 */

import {
  eyebrowClass,
  focusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalLanguage } from '../journal-language.ts';
import type {
  ExcerptSegment,
  SearchHit,
  SearchHitSource,
} from '../search-contract.ts';
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
  'day-report': 'From the day report',
} as const;

const excerptLanguages = {
  evening: journalLanguage,
  // A passage reference is shown in the app's English house style.
  'passage-reference': undefined,
  'scripture-notes': journalLanguage,
  // /wrap writes the report in English.
  'day-report': undefined,
} as const;

const excerptKey = (segments: ReadonlyArray<ExcerptSegment>): string =>
  segments.map(({ match, text }) => `${match ? '1' : '0'}:${text}`).join();

const Excerpt = ({
  agent,
  lang,
  segments,
}: {
  readonly agent: boolean;
  readonly lang: string | undefined;
  readonly segments: ReadonlyArray<ExcerptSegment>;
}) => (
  <span
    className={[
      readingMeasureClass,
      'mt-3 block min-w-0 break-words',
      agent ? 'text-base text-ink-muted' : 'text-ink text-lg',
    ].join(' ')}
    lang={lang}
  >
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

const SourceEvidence = ({ source }: { readonly source: SearchHitSource }) => {
  const agent = source.kind === 'day-report';
  return (
    <span
      className={[
        'mt-4 block',
        agent ? 'border-border border-l-2 pl-4' : '',
      ].join(' ')}
    >
      <span className={[eyebrowClass, 'block text-ink-faint'].join(' ')}>
        {sourceLabels[source.kind]}
      </span>
      {source.excerpts.map((excerpt) => (
        <Excerpt
          agent={agent}
          key={excerptKey(excerpt)}
          lang={excerptLanguages[source.kind]}
          segments={excerpt}
        />
      ))}
    </span>
  );
};

type SearchResultsProps = {
  readonly hits: ReadonlyArray<SearchHit>;
  readonly today: JournalDate;
};

export const SearchResults = ({ hits, today }: SearchResultsProps) => (
  <div>
    {hits.map((hit) => (
      <DayLink
        variant="text"
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
