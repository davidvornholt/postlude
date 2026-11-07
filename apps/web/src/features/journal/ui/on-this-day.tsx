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
 * the link, which would nest links inside links.
 *
 * A leap day written in an earlier year is read on February 28 when the year
 * being read has none, and says so (see `anniversary.ts`).
 */

import { useId } from 'react';

import {
  focusRingClass,
  readingMeasureClass,
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
import { JournalIcon } from './journal-icons.tsx';
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

const MemorySummary = ({
  anniversary,
  noteId,
}: {
  readonly anniversary: Anniversary;
  readonly noteId: string;
}) => (
  <summary
    className={[
      'flex cursor-pointer list-none items-start gap-4 py-4 [&::-webkit-details-marker]:hidden',
      focusRingClass,
    ].join(' ')}
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
        <span className="mt-1 block text-ink-muted text-sm" id={noteId}>
          Written on a leap day, and shown on February 28 because this year has
          no February 29.
        </span>
      ) : null}
      <span className="mt-1 line-clamp-2 text-ink-muted group-open/memory:hidden">
        {openingOf(anniversary)}
      </span>
    </span>
    <JournalIcon
      className="mt-0.5 size-5 shrink-0 text-ink-muted transition-[rotate] duration-200 ease-standard group-open/memory:rotate-180 motion-reduce:transition-none"
      name="expand"
    />
  </summary>
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
  date,
  today,
}: {
  readonly anniversary: Anniversary;
  readonly date: JournalDate;
  readonly today: JournalDate;
}) => {
  const noteId = useId();
  const morning =
    anniversary.scriptureReference !== undefined ||
    anniversary.scriptureTopic !== undefined ||
    hasWords(anniversary.scriptureMarkdown);
  const evening = hasWords(anniversary.journalMarkdown);
  // The parts are named only when there are two of them to tell apart.
  const both = morning && evening;
  return (
    <details
      aria-describedby={anniversary.leapDayOnFebruary28 ? noteId : undefined}
      className="group/memory border-border border-t"
    >
      <MemorySummary anniversary={anniversary} noteId={noteId} />
      <div className="pb-8">
        {morning ? (
          <MorningPart anniversary={anniversary} labelled={both} />
        ) : null}
        {evening ? (
          <EveningPart anniversary={anniversary} labelled={both} />
        ) : null}
        <DayLink
          className="mt-6"
          date={anniversary.date}
          from={date}
          today={today}
          variant="quiet"
        >
          Open this day
        </DayLink>
      </div>
    </details>
  );
};

type OnThisDayProps = {
  readonly date: JournalDate;
  readonly today: JournalDate;
  readonly anniversaries: ReadonlyArray<Anniversary>;
};

export const OnThisDay = ({ date, today, anniversaries }: OnThisDayProps) => {
  const headingId = useId();
  return (
    <PageFrame aria-labelledby={headingId} as="section" className="pt-6 pb-20">
      <div
        className={[readingMeasureClass, 'border-border border-t pt-10'].join(
          ' ',
        )}
      >
        <h2 className="font-display text-ink text-xl" id={headingId}>
          On this day
        </h2>
        <p className="mt-1 text-ink-muted">
          {anniversaries.length === 0
            ? 'Nothing was written on this date in an earlier year.'
            : 'The same date, in earlier years.'}
        </p>
        {anniversaries.length === 0 ? null : (
          <div className="mt-6 border-border border-b">
            {anniversaries.map((anniversary) => (
              <Memory
                anniversary={anniversary}
                date={date}
                key={anniversary.date}
                today={today}
              />
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
};
