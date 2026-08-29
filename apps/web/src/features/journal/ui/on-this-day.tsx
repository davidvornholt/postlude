/**
 * The same date, in the years before the one being read.
 *
 * Each memory keeps the morning and evening as separate parts of the same day,
 * but only labels the change between them. A passage identifies the morning by
 * itself. Read-only Markdown gives the writing the same setting as the day
 * page. The date is the route back to the editable day, since wrapping the
 * prose itself would create invalid nested links.
 */

import {
  eyebrowClass,
  focusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import type { Anniversary } from '../anniversary.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalCountLabel } from '../journal-labels.ts';
import {
  findScriptureBook,
  formatScriptureReference,
  scriptureReferenceUrl,
} from '../scripture-reference.ts';
import { DayLink } from './day-link.tsx';
import { ReadOnlyMarkdown } from './read-only-markdown.tsx';

const memoryClass = 'border-border border-t py-8 sm:py-10';
const sectionClass = [readingMeasureClass, 'min-w-0'].join(' ');
const proseClass = [
  'journal-prose min-w-0 hyphens-auto break-words text-ink text-lg leading-7',
].join(' ');

type OnThisDayProps = {
  readonly anniversaries: ReadonlyArray<Anniversary>;
  readonly today: JournalDate;
};

const ScriptureReferenceDisplay = ({
  reference,
}: {
  readonly reference: NonNullable<Anniversary['scriptureReference']>;
}) => {
  const referenceLabel = formatScriptureReference(reference);
  const referenceBook = findScriptureBook(reference.book);

  if (referenceBook === undefined) {
    return (
      <p className="py-1 font-display text-ink-muted text-xl">
        {referenceLabel}
      </p>
    );
  }

  return (
    <a
      aria-label={`Read ${referenceLabel} on bibleserver.com in a new tab`}
      className={[
        'inline-block py-1 font-display text-ink-muted text-xl underline underline-offset-4',
        'transition-colors duration-150 ease-standard hover:text-ink',
        focusRingClass,
      ].join(' ')}
      href={scriptureReferenceUrl(reference)}
      rel="noreferrer"
      target="_blank"
    >
      {referenceLabel}
    </a>
  );
};

const ScriptureMemory = ({
  anniversary,
}: {
  readonly anniversary: Anniversary;
}) => {
  const reference = anniversary.scriptureReference;
  const hasNotes = anniversary.scriptureMarkdown.trim() !== '';
  if (reference === undefined && !hasNotes) {
    return null;
  }

  return (
    <div className={[sectionClass, 'mt-6'].join(' ')}>
      {reference === undefined ? (
        <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>Morning</p>
      ) : (
        <ScriptureReferenceDisplay reference={reference} />
      )}
      {hasNotes ? (
        <ReadOnlyMarkdown
          className={[
            proseClass,
            reference === undefined ? 'mt-3' : 'mt-4',
          ].join(' ')}
          markdown={anniversary.scriptureMarkdown}
        />
      ) : null}
    </div>
  );
};

const EveningMemory = ({
  hasScripture,
  markdown,
}: {
  readonly hasScripture: boolean;
  readonly markdown: string;
}) =>
  markdown.trim() === '' ? null : (
    <div className={[sectionClass, hasScripture ? 'mt-8' : 'mt-6'].join(' ')}>
      {hasScripture ? (
        <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>Evening</p>
      ) : null}
      <ReadOnlyMarkdown
        className={hasScripture ? [proseClass, 'mt-4'].join(' ') : proseClass}
        markdown={markdown}
      />
    </div>
  );

const hasScriptureMemory = (anniversary: Anniversary): boolean =>
  anniversary.scriptureReference !== undefined ||
  anniversary.scriptureMarkdown.trim() !== '';

export const OnThisDay = ({ anniversaries, today }: OnThisDayProps) => (
  <div>
    {anniversaries.map((anniversary) => {
      const headingId = `anniversary-${anniversary.date}`;
      const hasScripture = hasScriptureMemory(anniversary);
      return (
        <article
          aria-labelledby={headingId}
          className={memoryClass}
          key={anniversary.date}
        >
          <h2 id={headingId}>
            <DayLink
              className={quietButtonClass}
              date={anniversary.date}
              today={today}
            >
              {`${journalCountLabel(anniversary.yearsAgo, 'year')} ago · ${journalDateLabel(anniversary.date)}`}
            </DayLink>
          </h2>
          <ScriptureMemory anniversary={anniversary} />
          <EveningMemory
            hasScripture={hasScripture}
            markdown={anniversary.journalMarkdown}
          />
        </article>
      );
    })}
  </div>
);
