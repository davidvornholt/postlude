/**
 * The morning scripture: a passage, and what the writer made of it.
 *
 * This is the deep register — the one inverse surface in the design, edge to
 * edge with its own column inside, so arriving at it reads as turning a page
 * rather than as meeting a card. It is optional every day; an untouched one is
 * a quiet band above the evening's writing and costs nothing to skip.
 *
 * The reference is typed as a line and stays a line here. Only the server
 * breaks it into book, chapter, and verses, so one parser decides what a
 * reference is for every way an entry can reach the table — but the same parser
 * runs here too, to build the link, which is why "Sprüche 12,5" opens the right
 * passage without being corrected first.
 */

import { useId } from 'react';

import {
  columnClass,
  deepFocusRingClass,
  eyebrowClass,
} from '#/shared/ui/design-classes.ts';
import { deepFieldClass } from '#/shared/ui/form-classes.ts';
import {
  formatScriptureReference,
  parseScriptureReference,
  scriptureReferenceUrl,
} from '../scripture-reference.ts';
import { MarkdownEditor } from './markdown-editor.tsx';

type ScriptureRegisterProps = {
  readonly reference: string;
  readonly referenceError: string | undefined;
  readonly onReferenceChange: (reference: string) => void;
  readonly initialMarkdown: string;
  readonly onMarkdownChange: (markdown: string) => void;
  /** Save now, because the writer has finished with a field. */
  readonly onLeave: () => void;
};

export const ScriptureRegister = ({
  reference,
  referenceError,
  onReferenceChange,
  initialMarkdown,
  onMarkdownChange,
  onLeave,
}: ScriptureRegisterProps) => {
  const headingId = useId();
  const fieldId = useId();
  const errorId = useId();
  const parsed = parseScriptureReference(reference);

  return (
    <section
      aria-labelledby={headingId}
      className="bg-deep-ground py-10 text-deep-ink sm:py-12"
    >
      <div className={columnClass}>
        <h2
          className={[eyebrowClass, 'text-deep-ink-muted'].join(' ')}
          id={headingId}
        >
          Morning scripture
        </h2>

        <label
          className={[eyebrowClass, 'mt-8 block text-deep-ink-muted'].join(' ')}
          htmlFor={fieldId}
        >
          Passage
        </label>
        <input
          aria-describedby={referenceError === undefined ? undefined : errorId}
          aria-invalid={referenceError === undefined ? undefined : true}
          autoComplete="off"
          className={[deepFieldClass, 'mt-2 font-display text-2xl'].join(' ')}
          id={fieldId}
          // Leaving the field is a save, the same as leaving either editor.
          onBlur={onLeave}
          onChange={(event) => onReferenceChange(event.target.value)}
          placeholder="Proverbs 12:5-13"
          type="text"
          value={reference}
        />

        {referenceError === undefined ? null : (
          <p className="mt-3 text-deep-ink" id={errorId}>
            {referenceError}
          </p>
        )}

        {/*
          The link appears only once the line is a passage, so it is absent for
          most of the keystrokes it takes to type one rather than flickering
          between a stale destination and none. `noreferrer` goes with `_blank`
          so the new tab cannot reach back through `opener`, and the
          destination is named in the link text, because a link that opens
          somewhere else should say so before it is followed.
        */}
        {parsed === undefined ? null : (
          <p className="mt-3">
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
          </p>
        )}

        <div className="mt-8">
          <MarkdownEditor
            focusClass={deepFocusRingClass}
            initialMarkdown={initialMarkdown}
            label="Morning scripture notes"
            onChange={onMarkdownChange}
            onLeave={onLeave}
            placeholder="What did the passage say this morning?"
            proseClass="journal-prose journal-prose-deep"
          />
        </div>
      </div>
    </section>
  );
};
