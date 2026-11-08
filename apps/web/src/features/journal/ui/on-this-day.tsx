/**
 * The same date in earlier years, at the end of the day being read.
 *
 * It follows the day on the page, so moving to another day moves the memories
 * with it, and it comes last, after the writing and the close of the day, so
 * the past never stands between the writer and today's page. Each year is
 * folded to its date and its opening words: enough to tell whether it is
 * worth reading now, without a decade of entries spread across the page.
 *
 * Opened, a year shows the morning and the evening as they were written, in
 * read-only Markdown, and a link to that day itself. The prose is not inside
 * the link, which would nest links inside links. A year opens by growing to
 * its height while its opening words fold away under the date, both at the
 * same pace, so the years below slide rather than jump.
 *
 * A leap day written in an earlier year is read on February 28 when the year
 * being read has none, and says so (see `anniversary.ts`).
 */

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { Collapsible } from '#/shared/ui/collapsible.tsx';
import {
  focusRingClass,
  readingMeasureClass,
  sectionHeadingClass,
} from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import type { Anniversary } from '../anniversary.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalCountLabel } from '../journal-labels.ts';
import {
  findScriptureBook,
  formatScriptureReference,
  scriptureReferenceUrl,
} from '../scripture-reference.ts';
import { journalSnippet } from '../snippet.ts';
import { DayLink } from './day-link.tsx';
import { ReadOnlyMarkdown } from './read-only-markdown.tsx';

const proseClass =
  'journal-prose min-w-0 hyphens-auto break-words text-ink text-lg leading-7';

const hasWords = (markdown: string): boolean => markdown.trim() !== '';

/** What a folded year shows of itself: its first words, or what it studied. */
const openingOf = (anniversary: Anniversary): string => {
  if (hasWords(anniversary.journalMarkdown)) {
    return journalSnippet(anniversary.journalMarkdown);
  }
  if (hasWords(anniversary.scriptureMarkdown)) {
    return journalSnippet(anniversary.scriptureMarkdown);
  }
  if (anniversary.scriptureReference !== undefined) {
    return formatScriptureReference(anniversary.scriptureReference);
  }
  return anniversary.scriptureTopic ?? '';
};

const StudiedLine = ({
  anniversary,
}: {
  readonly anniversary: Anniversary;
}) => {
  const reference = anniversary.scriptureReference;
  if (reference === undefined) {
    return anniversary.scriptureTopic === undefined ? null : (
      <p className="font-display text-ink-muted text-xl">
        {anniversary.scriptureTopic}
      </p>
    );
  }
  const label = formatScriptureReference(reference);
  if (findScriptureBook(reference.book) === undefined) {
    return <p className="font-display text-ink-muted text-xl">{label}</p>;
  }
  return (
    <a
      aria-label={`Read ${label} on bibleserver.com in a new tab`}
      className={[
        'font-display text-ink-muted text-xl underline underline-offset-4',
        'transition-colors duration-150 ease-standard hover:text-ink',
        focusRingClass,
      ].join(' ')}
      href={scriptureReferenceUrl(reference)}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
};

const PartLabel = ({ children }: { readonly children: string }) => (
  <p className="text-ink-faint text-sm">{children}</p>
);

/**
 * The year's heading, which is also what opens it: its date, and its opening
 * words while it is folded.
 */
const MemoryToggle = ({
  anniversary,
  bodyId,
  open,
  onToggle,
}: {
  readonly anniversary: Anniversary;
  readonly bodyId: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}) => (
  <h3>
    <button
      aria-controls={bodyId}
      aria-expanded={open}
      className={[
        'group/memory flex w-full cursor-pointer items-start gap-4 py-4 text-left',
        focusRingClass,
      ].join(' ')}
      onClick={onToggle}
      type="button"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-ink">
          {journalCountLabel(anniversary.yearsAgo, 'year')} ago
          <span className="text-ink-muted">
            {' '}
            · {journalDateLabel(anniversary.date)}
          </span>
        </span>
        {anniversary.leapDayOnFebruary28 ? (
          <span className="mt-1 block text-ink-muted text-sm">
            Written on a leap day, and shown on February 28 because this year
            has no February 29.
          </span>
        ) : null}
        <Collapsible as="span" open={!open}>
          <span className="mt-1 line-clamp-2 text-ink-muted">
            {openingOf(anniversary)}
          </span>
        </Collapsible>
      </span>
      <ChevronDown
        className={[
          'mt-0.5 shrink-0 text-ink-muted transition-[rotate,color] duration-300 ease-standard group-hover/memory:text-ink motion-reduce:transition-none',
          open ? 'rotate-180' : '',
        ].join(' ')}
      />
    </button>
  </h3>
);

/** The morning as it was kept: what was studied, and the notes on it. */
const MorningPart = ({
  anniversary,
  labelled,
}: {
  readonly anniversary: Anniversary;
  readonly labelled: boolean;
}) => {
  const studied =
    anniversary.scriptureReference !== undefined ||
    anniversary.scriptureTopic !== undefined;
  return (
    <div className="mt-2">
      {labelled ? <PartLabel>Morning</PartLabel> : null}
      <div className={labelled ? 'mt-2' : ''}>
        <StudiedLine anniversary={anniversary} />
      </div>
      {hasWords(anniversary.scriptureMarkdown) ? (
        <ReadOnlyMarkdown
          className={[proseClass, studied ? 'mt-3' : ''].join(' ')}
          markdown={anniversary.scriptureMarkdown}
        />
      ) : null}
    </div>
  );
};

const EveningPart = ({
  anniversary,
  labelled,
}: {
  readonly anniversary: Anniversary;
  readonly labelled: boolean;
}) => (
  <div className={labelled ? 'mt-8' : 'mt-2'}>
    {labelled ? <PartLabel>Evening</PartLabel> : null}
    <ReadOnlyMarkdown
      className={[proseClass, labelled ? 'mt-2' : ''].join(' ')}
      markdown={anniversary.journalMarkdown}
    />
  </div>
);

const Memory = ({
  anniversary,
  today,
}: {
  readonly anniversary: Anniversary;
  readonly today: JournalDate;
}) => {
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const morning =
    anniversary.scriptureReference !== undefined ||
    anniversary.scriptureTopic !== undefined ||
    hasWords(anniversary.scriptureMarkdown);
  const evening = hasWords(anniversary.journalMarkdown);
  // The parts are named only when there are two of them to tell apart.
  const both = morning && evening;
  return (
    <li>
      <MemoryToggle
        anniversary={anniversary}
        bodyId={bodyId}
        onToggle={() => setOpen((current) => !current)}
        open={open}
      />
      <Collapsible id={bodyId} open={open}>
        <div className="pb-6">
          {morning ? (
            <MorningPart anniversary={anniversary} labelled={both} />
          ) : null}
          {evening ? (
            <EveningPart anniversary={anniversary} labelled={both} />
          ) : null}
          <DayLink
            className="mt-6"
            date={anniversary.date}
            turnsPage={true}
            today={today}
            variant="quiet"
          >
            Open this day
          </DayLink>
        </div>
      </Collapsible>
    </li>
  );
};

type OnThisDayProps = {
  readonly today: JournalDate;
  readonly anniversaries: ReadonlyArray<Anniversary>;
};

export const OnThisDay = ({ today, anniversaries }: OnThisDayProps) => {
  const headingId = useId();
  return (
    <PageFrame aria-labelledby={headingId} as="section" className="pt-20 pb-24">
      <div className={readingMeasureClass}>
        <h2
          className={[sectionHeadingClass, 'text-ink'].join(' ')}
          id={headingId}
        >
          On this day
        </h2>
        <p className="mt-2 text-ink-muted">
          {anniversaries.length === 0
            ? 'Nothing was written on this date in an earlier year.'
            : 'The same date, in earlier years.'}
        </p>
        {anniversaries.length === 0 ? null : (
          <ul className="mt-6">
            {anniversaries.map((anniversary) => (
              <Memory
                anniversary={anniversary}
                key={anniversary.date}
                today={today}
              />
            ))}
          </ul>
        )}
      </div>
    </PageFrame>
  );
};
