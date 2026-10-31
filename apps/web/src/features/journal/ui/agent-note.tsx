/**
 * The note an agent wrote about the closed day.
 *
 * It is never mistaken for the writer's own words: it sits behind a rule of
 * its own, under a line that says an agent wrote it and which model, and it
 * is shown as plain text exactly as stored, never as markup. It is written in
 * the language of the day's entry, which is English when the entry is empty.
 *
 * Every state says what it is in words. A note being written says so and the
 * page looks again on its own; a note the writing has moved past says so and
 * offers a new one; a note that couldn't be written gives the reason. Until a
 * model is set up every note ends that way, and that case has calmer words of
 * its own, because nothing is wrong with the day.
 */

import { Button } from '#/shared/ui/action.tsx';
import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { notConfiguredMessage } from '../evening-messages.ts';
import { interfaceLanguage, journalLanguage } from '../journal-language.ts';
import type { AgentNoteView } from '../schemas/agent-area.ts';

type AgentNoteProps = {
  readonly note: AgentNoteView;
  readonly closed: boolean;
  /** An empty entry gets its note in English rather than the entry's language. */
  readonly journalIsEmpty: boolean;
  readonly regenerating: boolean;
  /** Something else is in progress, such as closing or reopening the day. */
  readonly blocked: boolean;
  readonly onRegenerate: () => void;
};

const NoteText = ({
  text,
  model,
  earlier,
  lang,
}: {
  readonly text: string;
  readonly model: string | null;
  readonly earlier: boolean;
  readonly lang: string;
}) => (
  <figure className="mt-4 border-border-strong border-l-2 pl-5">
    <figcaption className="text-ink-faint text-sm">
      {earlier ? 'Earlier note, written by an agent' : 'Written by an agent'}
      {model === null ? null : <>, {model}</>}
    </figcaption>
    <p
      className={[
        'mt-2 hyphens-auto whitespace-pre-wrap leading-7',
        earlier ? 'text-ink-muted' : 'text-ink',
      ].join(' ')}
      lang={lang}
    >
      {text}
    </p>
  </figure>
);

/** What the note's state is, in a sentence, or nothing for a current note. */
const stateLine = (
  note: AgentNoteView,
  closed: boolean,
): string | undefined => {
  switch (note.status) {
    case 'none':
      return closed
        ? 'No note was asked for on this day.'
        : 'When you close the day, an agent writes a short note on it from your ratings, your writing and the day’s numbers.';
    case 'pending':
      return 'An agent is writing a note on this day. It appears here when it is done.';
    case 'stale':
      return closed
        ? 'The writing changed after this note was written.'
        : 'The writing changed after this note was written. Close the day again for a new one.';
    case 'failed':
      return note.error === notConfiguredMessage
        ? 'Agent notes are not set up yet, so no note was written for this day. Once they are, ask for one here.'
        : (note.error ?? 'The note could not be written.');
    default:
      return;
  }
};

const actionLabel = (note: AgentNoteView): string => {
  if (note.status === 'none') {
    return 'Ask for a note';
  }
  return note.error === notConfiguredMessage && note.status === 'failed'
    ? 'Ask for a note'
    : 'Ask for a new note';
};

export const AgentNote = ({
  note,
  closed,
  journalIsEmpty,
  regenerating,
  blocked,
  onRegenerate,
}: AgentNoteProps) => {
  const line = stateLine(note, closed);
  const offersNewNote =
    closed &&
    (note.status === 'none' ||
      note.status === 'stale' ||
      note.status === 'failed');
  const current = note.status === 'ready' || note.status === 'stale';

  return (
    <div>
      <h3 className={[eyebrowClass, 'text-ink-muted'].join(' ')}>Agent note</h3>
      <div aria-live="polite" role="status">
        {line === undefined ? null : (
          <p
            className={[
              'mt-3',
              note.status === 'stale' ? 'text-ink' : 'text-ink-muted',
            ].join(' ')}
            data-agent-note-status={note.status}
          >
            {line}
          </p>
        )}
      </div>
      {note.note === null ? null : (
        <NoteText
          earlier={!current}
          lang={journalIsEmpty ? interfaceLanguage : journalLanguage}
          model={note.model}
          text={note.note}
        />
      )}
      {offersNewNote ? (
        <Button
          aria-busy={regenerating}
          className="mt-5"
          disabled={regenerating || blocked}
          onClick={onRegenerate}
          variant="quiet"
        >
          {regenerating ? 'Asking…' : actionLabel(note)}
        </Button>
      ) : null}
    </div>
  );
};
