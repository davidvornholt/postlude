/**
 * One journal day, as a page.
 *
 * The day runs in the order it was lived: the morning scripture first, in the
 * deep register, then the evening's writing on the parchment. There is no save
 * button and no edit mode — the page opens on the words and the words are
 * already editable, because a journal that asks to be unlocked before it can be
 * written in is one more thing to do before writing.
 *
 * Under the writing come the years behind this same date. They sit last on
 * purpose: this is the page for writing an evening, and old entries stacked in
 * front of the editor would put reading ahead of it. Below the words they are
 * what they should be — something to find after the day is closed out, or a
 * prompt on a date that is still empty.
 *
 * A day is written on the page it is read on, so this same component serves
 * today and any day in the archive. Only the route differs.
 */

import { useId } from 'react';

import {
  eyebrowClass,
  focusRingClass,
  pageFrameClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import type { Anniversary } from '../anniversary.ts';
import { journalDateLabel, journalDayRelation } from '../day-label.ts';
import {
  daysBetweenJournalDates,
  earliestJournalDate,
  type JournalDate,
  shiftJournalDate,
} from '../journal-day.ts';
import type { EntryDraft, JournalEntry } from '../schemas/entry.ts';
import { formatScriptureReference } from '../scripture-reference.ts';
import { DayJump } from './day-jump.tsx';
import { DayLink } from './day-link.tsx';
import { EntryCounts } from './entry-counts.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';
import { OnThisDay } from './on-this-day.tsx';
import { SaveStatusLine } from './save-status.tsx';
import { ScriptureRegister } from './scripture-register.tsx';
import { type SaveDraft, useAutosave } from './use-autosave.ts';

type DayPageProps = {
  readonly entry: JournalEntry;
  /** The server's own journal day, which is what "today" means everywhere. */
  readonly today: JournalDate;
  /** The same date in the years behind it, newest first. */
  readonly anniversaries: ReadonlyArray<Anniversary>;
  /**
   * Where the writing goes. Passed in rather than imported so that rendering a
   * day needs nothing the database needs; the routes hand over the real one.
   */
  readonly save: SaveDraft;
};

/**
 * The entry as the editors and the autosave rule take it: markdown and a typed
 * reference line, with counts and database metadata left behind. The stored
 * reference is re-rendered in the one house style rather than kept as whatever
 * was typed, so a day reopened weeks later reads the way the archive does.
 */
const draftOf = (entry: JournalEntry): EntryDraft => ({
  date: entry.date,
  journalMarkdown: entry.journalMarkdown,
  scriptureMarkdown: entry.scriptureMarkdown,
  scriptureReference:
    entry.scriptureReference === undefined
      ? ''
      : formatScriptureReference(entry.scriptureReference),
  baseRevision: entry.revision,
});

const DayBody = ({ entry, today, save, anniversaries }: DayPageProps) => {
  const autosave = useAutosave(
    { draft: draftOf(entry), revision: entry.revision },
    save,
  );
  const referenceError =
    autosave.failure?.kind === 'validation'
      ? autosave.failure.message
      : undefined;
  const eveningId = useId();
  const memoryId = useId();
  const previous =
    entry.date === earliestJournalDate
      ? undefined
      : shiftJournalDate(entry.date, -1);
  const elapsed = daysBetweenJournalDates(entry.date, today);
  // No link forward from today: the next day has not been lived, and offering
  // it would invite writing an evening that has not happened.
  const next = elapsed > 0 ? shiftJournalDate(entry.date, 1) : undefined;

  return (
    <>
      <header className={pageFrameClass}>
        <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>
          {journalDayRelation(entry.date, today)}
        </p>
        {/* Balanced, because a date is one thing and breaking it after the
            month leaves a year alone on a line. The browser evens the lines
            out instead of filling the first one and dropping what is left. */}
        <h1 className="mt-3 text-balance font-display text-4xl text-ink sm:text-5xl">
          {journalDateLabel(entry.date)}
        </h1>
        {/* The links and the date field answer the same question — which day
            am I looking at — so they are one landmark rather than a nav and a
            stray form beside it. They sit on one row while there is room and
            fall onto two when there is not, with the field last, because a
            step to yesterday is the common move and naming a date is not. */}
        <nav
          aria-label="Nearby days"
          className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-6"
        >
          <div className="flex gap-8 pb-1">
            {previous === undefined ? null : (
              <DayLink
                className={quietButtonClass}
                date={previous}
                today={today}
              >
                <span aria-hidden="true">←</span> Previous day
              </DayLink>
            )}
            {next === undefined ? null : (
              <DayLink className={quietButtonClass} date={next} today={today}>
                Next day <span aria-hidden="true">→</span>
              </DayLink>
            )}
          </div>
          <DayJump date={entry.date} today={today} />
        </nav>
      </header>

      <div className="mt-10 sm:mt-14">
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
          referenceError={referenceError}
        />
      </div>

      <section
        aria-labelledby={eveningId}
        className={[pageFrameClass, 'mt-10 sm:mt-14'].join(' ')}
      >
        <h2
          className={[eyebrowClass, 'text-ink-muted'].join(' ')}
          id={eveningId}
        >
          Evening
        </h2>
        {/* The frame is the archive's now, which is wider than anyone wants to
            write a paragraph across, so the writing keeps its own measure
            inside it and starts on the same line as everything above it. */}
        <div className={[readingMeasureClass, 'mt-6'].join(' ')}>
          <MarkdownEditor
            focusClass={focusRingClass}
            initialMarkdown={autosave.draft.journalMarkdown}
            label="Evening journal"
            onChange={(journalMarkdown) => autosave.edit({ journalMarkdown })}
            onLeave={autosave.flush}
            placeholder="How did the day go?"
            proseClass="journal-prose"
          />
        </div>
        {/* The count and the save state are the page's only chrome, and they
            sit below the writing rather than beside it, so nothing hovers next
            to the words while they are being typed. The rule above them is the
            writing area's own, which follows the words down as the entry
            grows; a second one here would be the same line drawn twice. */}
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
      </section>

      {/* Absent on a date with no years behind it, rather than present and
          empty. A heading over nothing would take a section of the page every
          day of a journal's first year to say that there is nothing yet. */}
      {anniversaries.length === 0 ? null : (
        <section
          aria-labelledby={memoryId}
          className={[pageFrameClass, 'mt-12 sm:mt-16'].join(' ')}
        >
          <h2
            className={[
              eyebrowClass,
              'border-border border-t pt-8 text-ink-muted',
            ].join(' ')}
            id={memoryId}
          >
            On this day
          </h2>
          <div className="mt-8">
            <OnThisDay anniversaries={anniversaries} today={today} />
          </div>
        </section>
      )}
    </>
  );
};

/**
 * The autosave rule opens on the entry it is given and then owns the draft, so
 * a new day has to arrive as a new component rather than as a new prop —
 * otherwise moving from one day to the next would leave yesterday's words in
 * the editor and post them to today. The key is set here rather than at the
 * call sites, so no route can forget it.
 */
export const DayPage = ({
  entry,
  today,
  save,
  anniversaries,
}: DayPageProps) => (
  <DayBody
    anniversaries={anniversaries}
    entry={entry}
    key={entry.date}
    save={save}
    today={today}
  />
);
