/**
 * The writing page: one journal day, set as a single column.
 *
 * Reading order is the order the day happened in. The running head states the
 * date and, opposite it, what the page is doing for you — the counts and the
 * save, in figures that line up because they are tabular. Then the day itself,
 * then the morning's passage in the deep register, then the evening's writing
 * at a measure short enough to keep the line.
 *
 * "Saturday evening" is the one italic phrase on this page. Italics mark
 * reverence here, not volume, so spending them once is the whole point.
 */

import { useId } from 'react';

import {
  countCharacters,
  countWords,
  groupDigits,
  journalText,
  sampleDay,
} from '#/features/design-comparison/content.ts';
import { ScriptureRegister } from '#/features/design-comparison/ui/warm-print/scripture-register.tsx';
import {
  columnClass,
  enterClass,
  eyebrowClass,
  ruledEyebrowClass,
} from '#/features/design-comparison/ui/warm-print/warm-print-classes.ts';

const words = countWords(journalText);
const characters = countCharacters(journalText);

const runningHeadClass = [eyebrowClass, 'text-ink-faint tabular-nums'].join(
  ' ',
);

export const WarmPrintDay = () => {
  const scriptureHeadingId = useId();
  const eveningHeadingId = useId();

  return (
    <div className="pb-20">
      <div className={[columnClass, enterClass, 'pt-10 sm:pt-14'].join(' ')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-border border-b pb-3">
          <p className={runningHeadClass}>{sampleDay.dateLabel}</p>
          <p className={runningHeadClass}>
            {groupDigits(words)} words · {groupDigits(characters)} characters ·{' '}
            {sampleDay.autosaveState}
          </p>
        </div>

        <h1 className="mt-10 mb-12 font-display text-ink">
          <span className="block text-4xl italic leading-tight sm:text-5xl">
            {sampleDay.weekdayLabel}
          </span>{' '}
          <span className="mt-3 block text-2xl text-ink-muted tabular-nums sm:text-3xl">
            {sampleDay.dateLabel}
          </span>
        </h1>
      </div>

      <ScriptureRegister headingId={scriptureHeadingId} />

      <section
        aria-labelledby={eveningHeadingId}
        className={[columnClass, enterClass, 'pt-10 sm:pt-14'].join(' ')}
      >
        <h2
          className={[ruledEyebrowClass, 'border-border text-ink-faint'].join(
            ' ',
          )}
          id={eveningHeadingId}
        >
          Evening
        </h2>
        <div className="mt-8 space-y-6 hyphens-auto text-base text-ink leading-relaxed sm:text-lg">
          {sampleDay.journalParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </div>
  );
};
