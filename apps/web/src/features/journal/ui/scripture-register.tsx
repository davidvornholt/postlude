/**
 * The morning scripture: what was studied, and what the writer made of it.
 *
 * This is the deep register — the one separate surface in the design, edge to
 * edge with its own frame inside, so arriving at it reads as turning a page
 * rather than as meeting a card. It is optional every day; an untouched one is
 * a quiet band above the evening's writing and costs nothing to skip.
 *
 * What was studied is one line, and it is either a passage or a topic. Only
 * the server decides which, with the same parser that runs here: a line that
 * reads as a passage is kept as one and links to it, and anything else is kept
 * as written, as the topic of the morning. So "Sprüche 12,5" opens the right
 * passage without being corrected first, and "Forgiveness" is never refused.
 * A long topic wraps onto further lines of the field rather than running out
 * of sight, and stays one paragraph.
 */

import { useId } from 'react';
import {
  deepFocusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { WrappingTextField } from '#/shared/ui/text-field.tsx';
import {
  formatScriptureReference,
  parseScriptureReference,
  scriptureReferenceUrl,
  scriptureTopicOf,
} from '../scripture-reference.ts';
import { MarkdownEditor } from './markdown-editor.tsx';
import { WritingSection } from './writing-section.tsx';

type ScriptureRegisterProps = {
  readonly reference: string;
  readonly onReferenceChange: (reference: string) => void;
  readonly initialMarkdown: string;
  readonly onMarkdownChange: (markdown: string) => void;
  /** Save now, because the writer has finished with a field. */
  readonly onLeave: () => void;
};

/**
 * What the line will be kept as, said under it. The line holds its height
 * whether it has anything to say or not, so the notes below never jump as a
 * passage becomes a link. `noreferrer` goes with `_blank` so the new tab cannot
 * reach back through `opener`, and the destination is named in the link text,
 * because a link that opens somewhere else should say so before it is followed.
 */
const ReadingNote = ({ reference }: { readonly reference: string }) => {
  const parsed = parseScriptureReference(reference);
  if (parsed !== undefined) {
    return (
      <a
        className={[
          'text-deep-ink underline underline-offset-4',
          deepFocusRingClass,
        ].join(' ')}
        href={scriptureReferenceUrl(parsed)}
        rel="noreferrer"
        target="_blank"
      >
        Read {formatScriptureReference(parsed)} on bibleserver.com
      </a>
    );
  }
  return scriptureTopicOf(reference) === undefined ? null : (
    <span className="text-deep-ink-muted">Kept as a topic</span>
  );
};

export const ScriptureRegister = ({
  reference,
  onReferenceChange,
  initialMarkdown,
  onMarkdownChange,
  onLeave,
}: ScriptureRegisterProps) => {
  const fieldId = useId();

  return (
    <WritingSection title="Morning scripture" tone="deep">
      {/* The measure is set at the page's type size, so the line ends where
          the notes below it do rather than at the passage's larger size. */}
      <div className={readingMeasureClass}>
        <label className="block text-deep-ink-muted text-sm" htmlFor={fieldId}>
          Passage or topic
        </label>
        <WrappingTextField
          autoComplete="off"
          tone="deep"
          className="mt-2 font-display text-xl"
          id={fieldId}
          // Leaving the field is a save, the same as leaving either editor,
          // and Enter leaves it.
          onBlur={onLeave}
          onValueChange={onReferenceChange}
          placeholder="Proverbs 12:5-13, or a topic"
          value={reference}
        />
        <p className="mt-2 min-h-6 text-sm">
          <ReadingNote reference={reference} />
        </p>
      </div>

      {/* The notes go by their prompt, as the evening does, and are named in
          full for assistive technology. */}
      <div className={[readingMeasureClass, 'mt-6'].join(' ')}>
        <MarkdownEditor
          focusClass={deepFocusRingClass}
          initialMarkdown={initialMarkdown}
          label="Morning scripture notes"
          onChange={onMarkdownChange}
          onLeave={onLeave}
          placeholder="What did the morning's reading say?"
          proseClass="journal-prose journal-prose-deep"
          size="notes"
        />
      </div>
    </WritingSection>
  );
};
