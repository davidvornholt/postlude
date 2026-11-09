/**
 * One journal day, as a page.
 *
 * Under the date comes the morning scripture, in the deep register, then the
 * evening around the writing on the parchment (`evening-flow.tsx` says why it
 * runs in that order), and the page ends on the same date in earlier years.
 *
 * There is no save button and no edit mode: the page opens on the words and
 * the words are already editable, because a journal that asks to be unlocked
 * before it can be written in is one more thing to do before writing.
 *
 * A day is written on the page it is read on, so this same component serves
 * today, a planned future day, and any day in the archive. Only the route
 * differs. The date at the top is the way to another day (`day-header.tsx`).
 */

import { useRef } from 'react';
import {
  focusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import type { Anniversary } from '../anniversary.ts';
import type { JournalDate } from '../journal-day.ts';
import type { EntryDraft, JournalEntry } from '../schemas/entry.ts';
import { scriptureLineOf } from '../scripture-reference.ts';
import type { EveningActions, EveningView } from '../services/evening-fns.ts';
import { DayHeader } from './day-header.tsx';
import type { ReadWrittenDays } from './day-picker.tsx';
import { EntryCounts } from './entry-counts.tsx';
import { EveningClosing, EveningRatings } from './evening-flow.tsx';
import { type EditorFocus, MarkdownEditor } from './markdown-editor.tsx';
import { OnThisDay } from './on-this-day.tsx';
import { SaveStatusLine } from './save-status.tsx';
import { ScriptureRegister } from './scripture-register.tsx';
import { type SaveDraft, useAutosave } from './use-autosave.ts';
import { useDaySteps } from './use-day-steps.ts';
import { useEvening } from './use-evening.ts';
import { WritingSection } from './writing-section.tsx';

type DayPageProps = {
  readonly entry: JournalEntry;
  /** The server's own journal day, which is what "today" means everywhere. */
  readonly today: JournalDate;
  /**
   * Where the writing goes. Passed in rather than imported so that rendering a
   * day needs nothing the database needs; the routes hand over the real one.
   */
  readonly save: SaveDraft;
  /**
   * The day's ratings, report and agent note, as the server has them, or
   * undefined when they couldn't be read, so the writing still shows.
   */
  readonly evening: EveningView | undefined;
  /** Where the ratings and the closing go, passed in for the same reason. */
  readonly eveningActions: EveningActions;
  /** The same date in earlier years, read with the day. */
  readonly anniversaries: ReadonlyArray<Anniversary>;
  /** Which days of a month have writing, for the calendar under the date. */
  readonly readWrittenDays: ReadWrittenDays;
};

/**
 * The entry as the editors and the autosave rule take it: markdown and the
 * line of what was studied, with counts and database metadata left behind. A
 * stored passage is re-rendered in the one house style rather than kept as
 * whatever was typed, so a day reopened weeks later reads the way the archive
 * does. A topic is kept as it was written.
 */
const draftOf = (entry: JournalEntry): EntryDraft => ({
  date: entry.date,
  journalMarkdown: entry.journalMarkdown,
  scriptureMarkdown: entry.scriptureMarkdown,
  scriptureReference: scriptureLineOf(entry),
  baseRevision: entry.revision,
});

const DayBody = ({
  entry,
  today,
  save,
  evening: eveningView,
  eveningActions,
  anniversaries,
  readWrittenDays,
}: DayPageProps) => {
  const autosave = useAutosave(
    { draft: draftOf(entry), revision: entry.revision },
    save,
  );
  const eveningEditorRef = useRef<EditorFocus>(null);
  const { next, openDay, previous } = useDaySteps(entry.date, today);
  const begun = entry.date <= today;
  const evening = useEvening(
    entry.date,
    begun ? eveningView : undefined,
    eveningActions,
    autosave.draft.baseRevision,
  );

  return (
    <article>
      <DayHeader
        copyDay={autosave.draft}
        date={entry.date}
        next={next}
        onChoose={openDay}
        previous={previous}
        readWrittenDays={readWrittenDays}
        today={today}
      />

      <ScriptureRegister
        initialMarkdown={autosave.draft.scriptureMarkdown}
        onLeave={autosave.flush}
        onMarkdownChange={(scriptureMarkdown) =>
          autosave.edit({ scriptureMarkdown })
        }
        onReferenceChange={(scriptureReference) =>
          autosave.edit({ scriptureReference })
        }
        reference={autosave.draft.scriptureReference}
      />

      <EveningRatings
        begun={begun}
        evening={evening}
        onToWriting={() => eveningEditorRef.current?.focusEnd()}
      />

      <WritingSection title="Evening" tone="page">
        {/* The frame is the one Insights uses, which is wider than anyone wants to
            write a paragraph across, so the writing keeps its own measure
            inside it and starts on the same line as everything above it. */}
        <div className={readingMeasureClass}>
          <MarkdownEditor
            focusClass={focusRingClass}
            focusHandle={eveningEditorRef}
            initialMarkdown={autosave.draft.journalMarkdown}
            label="Evening journal"
            onChange={(journalMarkdown) => autosave.edit({ journalMarkdown })}
            onLeave={autosave.flush}
            placeholder="Why you did what you did, what you thought and felt, and what happened away from the screen."
            proseClass="journal-prose"
            size="entry"
          />
        </div>
        {/* The count and the save state sit below the writing rather than
            beside it, so nothing hovers next to the words while they are being
            typed. */}
        <div
          className={[
            readingMeasureClass,
            'mt-4 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3',
          ].join(' ')}
        >
          <EntryCounts markdown={autosave.draft.journalMarkdown} />
          <SaveStatusLine
            failure={autosave.failure}
            onRetry={autosave.flush}
            status={autosave.status}
          />
        </div>
      </WritingSection>

      {evening === undefined ? null : (
        <EveningClosing
          evening={evening}
          journalIsEmpty={autosave.draft.journalMarkdown.trim() === ''}
        />
      )}

      <OnThisDay anniversaries={anniversaries} today={today} />
    </article>
  );
};

/**
 * The autosave rule opens on the entry it is given and then owns the draft, so
 * a new day has to arrive as a new component rather than as a new prop —
 * otherwise moving from one day to the next would leave yesterday's words in
 * the editor and post them to today. The key is set here rather than at the
 * call sites, so no route can forget it.
 */
export const DayPage = (props: DayPageProps) => (
  <DayBody key={props.entry.date} {...props} />
);
