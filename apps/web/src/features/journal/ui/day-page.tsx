/**
 * One journal day, as a page.
 *
 * The day runs in the order it was lived: the morning scripture first, in the
 * deep register, then the evening's writing on the parchment. There is no save
 * button and no edit mode — the page opens on the words and the words are
 * already editable, because a journal that asks to be unlocked before it can be
 * written in is one more thing to do before writing.
 *
 * A day is written on the page it is read on, so this same component serves
 * today and any day in the archive. Only the route differs.
 */

import { Link } from '@tanstack/react-router';
import { type ReactNode, useId } from 'react';

import {
  columnClass,
  eyebrowClass,
  focusRingClass,
} from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import { journalDateLabel, journalDayRelation } from '../day-label.ts';
import {
  daysBetweenJournalDates,
  type JournalDate,
  shiftJournalDate,
} from '../journal-day.ts';
import type { EntryDraft, JournalEntry } from '../schemas/entry.ts';
import { formatScriptureReference } from '../scripture-reference.ts';
import { EntryCounts } from './entry-counts.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';
import { SaveStatusLine } from './save-status.tsx';
import { ScriptureRegister } from './scripture-register.tsx';
import { type SaveDraft, useAutosave } from './use-autosave.ts';

type DayPageProps = {
  readonly entry: JournalEntry;
  /** The server's own journal day, which is what "today" means everywhere. */
  readonly today: JournalDate;
  /**
   * Where the writing goes. Passed in rather than imported so that rendering a
   * day needs nothing the database needs; the routes hand over the real one.
   */
  readonly save: SaveDraft;
};

/**
 * Today keeps the plain address. Linking a neighbour that happens to be today
 * to `/day/<today>` would work — the route redirects — but it would put a
 * redirect between the writer and the page they use most.
 */
const DayLink = ({
  date,
  today,
  children,
}: {
  readonly date: JournalDate;
  readonly today: JournalDate;
  readonly children: ReactNode;
}) =>
  date === today ? (
    <Link className={quietButtonClass} to="/">
      {children}
    </Link>
  ) : (
    <Link className={quietButtonClass} params={{ date }} to="/day/$date">
      {children}
    </Link>
  );

/**
 * The entry as the editors and the autosave rule take it: markdown and a typed
 * reference line, with the counts and the timestamps left behind. The stored
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
});

const DayBody = ({ entry, today, save }: DayPageProps) => {
  const autosave = useAutosave(draftOf(entry), save);
  const eveningId = useId();
  const previous = shiftJournalDate(entry.date, -1);
  const elapsed = daysBetweenJournalDates(entry.date, today);
  // No link forward from today: the next day has not been lived, and offering
  // it would invite writing an evening that has not happened.
  const next = elapsed > 0 ? shiftJournalDate(entry.date, 1) : undefined;

  return (
    <>
      <header className={columnClass}>
        <p className={[eyebrowClass, 'text-ink-faint'].join(' ')}>
          {journalDayRelation(entry.date, today)}
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
          {journalDateLabel(entry.date)}
        </h1>
        <nav aria-label="Nearby days" className="mt-8 flex gap-8">
          <DayLink date={previous} today={today}>
            <span aria-hidden="true">←</span> Previous day
          </DayLink>
          {next === undefined ? null : (
            <DayLink date={next} today={today}>
              Next day <span aria-hidden="true">→</span>
            </DayLink>
          )}
        </nav>
      </header>

      <div className="mt-10 sm:mt-14">
        <ScriptureRegister
          initialMarkdown={entry.scriptureMarkdown}
          onLeave={autosave.flush}
          onMarkdownChange={(scriptureMarkdown) =>
            autosave.edit({ scriptureMarkdown })
          }
          onReferenceChange={(scriptureReference) =>
            autosave.edit({ scriptureReference })
          }
          reference={autosave.draft.scriptureReference}
        />
      </div>

      <section
        aria-labelledby={eveningId}
        className={[columnClass, 'mt-10 sm:mt-14'].join(' ')}
      >
        <h2
          className={[eyebrowClass, 'text-ink-muted'].join(' ')}
          id={eveningId}
        >
          Evening
        </h2>
        <div className="mt-6">
          <MarkdownEditor
            focusClass={focusRingClass}
            initialMarkdown={entry.journalMarkdown}
            label="Evening journal"
            onChange={(journalMarkdown) => autosave.edit({ journalMarkdown })}
            onLeave={autosave.flush}
            placeholder="How the day went …"
            proseClass="journal-prose"
          />
        </div>
        {/* The count and the save state are the page's only chrome, and they
            sit under a rule at the foot of the writing rather than beside it,
            so nothing hovers next to the words while they are being typed. */}
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-border border-t pt-4">
          <EntryCounts markdown={autosave.draft.journalMarkdown} />
          <SaveStatusLine onRetry={autosave.flush} status={autosave.status} />
        </div>
      </section>
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
export const DayPage = ({ entry, today, save }: DayPageProps) => (
  <DayBody entry={entry} key={entry.date} save={save} today={today} />
);
