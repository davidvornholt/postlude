/**
 * The writing page: one day, bound at the left edge like a leaf out of the
 * book it belongs to.
 *
 * Reading order is the order the day happened in — what the page is doing for
 * you (saved, counted), then which day this is, then the morning's passage,
 * then the evening's writing at a measure short enough to read without losing
 * the line.
 */

import { useId } from 'react';
import { journalStreakDays } from '#/features/design-comparison/archive-data.ts';
import {
  countCharacters,
  countWords,
  groupDigits,
  journalText,
  sampleDay,
} from '#/features/design-comparison/content.ts';
import { BindingStrip } from '#/features/design-comparison/ui/heirloom/binding-strip.tsx';
import {
  displayHeadingClass,
  featuredCardClass,
  labelClass,
} from '#/features/design-comparison/ui/heirloom/heirloom-classes.ts';
import { ScriptureCard } from '#/features/design-comparison/ui/heirloom/scripture-card.tsx';

const words = countWords(journalText);
const characters = countCharacters(journalText);

export const HeirloomDayLeaf = () => {
  const scriptureHeadingId = useId();
  const eveningHeadingId = useId();

  return (
    <article className={[featuredCardClass, 'flex'].join(' ')}>
      <BindingStrip streakDays={journalStreakDays} />
      <div className="min-w-0 flex-1 px-5 py-6 sm:px-10 sm:py-9">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-border border-b pb-4">
          <p className={labelClass}>{sampleDay.autosaveState}</p>
          <p className={labelClass}>
            {groupDigits(words)} words · {groupDigits(characters)} characters
          </p>
        </div>

        <h1 className={[displayHeadingClass, 'mt-8'].join(' ')}>
          <span className="block text-3xl sm:text-4xl">
            {sampleDay.weekdayLabel}
          </span>{' '}
          <span className="mt-1 block text-ink-muted text-xl sm:text-2xl">
            {sampleDay.dateLabel}
          </span>
        </h1>

        <ScriptureCard headingId={scriptureHeadingId} />

        <section aria-labelledby={eveningHeadingId} className="mt-10">
          <h2 className={labelClass} id={eveningHeadingId}>
            Evening
          </h2>
          <div className="mt-4 max-w-prose space-y-5 text-ink text-lg leading-relaxed">
            {sampleDay.journalParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
};
