/**
 * The morning half of the day: one passage and the few lines it left behind.
 *
 * The reference is the only thing here that goes anywhere, so it is the only
 * thing set in the display face — tapping it opens the passage on bibleserver
 * in the translation named beside it. The notes stay small and quiet; they are
 * notes, not the entry.
 */

import {
  sampleDay,
  scriptureReference,
} from '#/features/design-comparison/content.ts';
import {
  focusRingClass,
  labelClass,
} from '#/features/design-comparison/ui/heirloom/heirloom-classes.ts';

const passage = sampleDay.scripture;

const referenceLinkClass = [
  'inline-block font-display text-2xl text-primary underline decoration-accent decoration-1 underline-offset-4',
  'transition-colors duration-150 ease-standard hover:text-primary-strong hover:decoration-2 active:translate-y-px',
  'motion-reduce:transition-none motion-reduce:active:translate-y-0',
  focusRingClass,
].join(' ');

export const ScriptureCard = ({
  headingId,
}: {
  readonly headingId: string;
}) => (
  <section
    aria-labelledby={headingId}
    className="mt-8 border border-border border-l-2 border-l-accent bg-surface-sunken px-5 py-5 sm:px-6"
  >
    <h2 className={labelClass} id={headingId}>
      Scripture
    </h2>
    <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <a className={referenceLinkClass} href={passage.href}>
        {scriptureReference(passage)}
      </a>
      <span className={labelClass}>{passage.translation}</span>
    </p>
    <ul className="mt-5 max-w-prose space-y-3 text-ink-muted text-sm leading-relaxed">
      {passage.notes.map((note) => (
        <li className="flex gap-3" key={note}>
          <span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-accent" />
          <span>{note}</span>
        </li>
      ))}
    </ul>
  </section>
);
