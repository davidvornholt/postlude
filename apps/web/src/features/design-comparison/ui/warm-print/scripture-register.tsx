/**
 * The morning half of the day, set in the deep register.
 *
 * This is the one inverse surface on the writing page: the ground goes dark
 * under light type and the rules stay hairline, so reaching it feels like
 * turning a page rather than arriving somewhere else. In dark mode the register
 * inverts to parchment for the same reason — the page around it is already
 * dark, so the turn has to go the other way.
 *
 * The reference is the only thing here that goes anywhere, so it is the only
 * thing set in the display face: tapping it opens the passage on bibleserver in
 * the translation named beside it. Hovering nudges the mark, rather than
 * recolouring the link.
 */

import {
  sampleDay,
  scriptureReference,
} from '#/features/design-comparison/content.ts';
import {
  columnClass,
  deepFocusRingClass,
  deepRegisterClass,
  enterClass,
  eyebrowClass,
  ruledEyebrowClass,
} from '#/features/design-comparison/ui/warm-print/warm-print-classes.ts';

const passage = sampleDay.scripture;

const referenceLinkClass = [
  'group inline-flex items-baseline gap-2 font-display text-2xl sm:text-3xl',
  deepFocusRingClass,
].join(' ');

// The rule belongs to the words, not to the mark beside them: a decoration set
// on the link itself would be drawn straight through the arrow too.
const referenceTextClass = 'underline decoration-1 underline-offset-8';

// The mark leaves with the link, so it is drawn in the body face, where the
// glyph is guaranteed to exist.
const openMarkClass =
  'font-sans text-base transition-transform duration-200 ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none';

export const ScriptureRegister = ({
  headingId,
}: {
  readonly headingId: string;
}) => (
  <section
    aria-labelledby={headingId}
    className={[deepRegisterClass, enterClass].join(' ')}
  >
    <div className={[columnClass, 'py-10 sm:py-14'].join(' ')}>
      <h2
        className={[
          ruledEyebrowClass,
          'border-deep-rule text-deep-ink-muted',
        ].join(' ')}
        id={headingId}
      >
        Morning scripture
      </h2>
      <p className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <a className={referenceLinkClass} href={passage.href}>
          <span className={referenceTextClass}>
            {scriptureReference(passage)}
          </span>
          <span aria-hidden="true" className={openMarkClass}>
            ↗
          </span>
        </a>
        <span className={[eyebrowClass, 'text-deep-ink-muted'].join(' ')}>
          {passage.translation}
        </span>
      </p>
      <ul className="mt-8 space-y-4 text-base text-deep-ink-muted leading-relaxed">
        {passage.notes.map((note) => (
          <li className="flex gap-4" key={note}>
            <span
              aria-hidden="true"
              className="mt-2.5 size-1 shrink-0 bg-deep-ink-muted"
            />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
