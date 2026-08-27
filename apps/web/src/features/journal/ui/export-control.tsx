/**
 * Taking the journal out of the app.
 *
 * The browser owns the download. A native POST preserves the response stream,
 * filename, authentication redirect, and safe server error page instead of
 * turning the archive into a blob held in client memory. Before a hydrated
 * page submits, it settles any browser autosave so the archive cannot omit the
 * latest words. With JavaScript absent, the same form posts directly.
 */

import type { RefObject, SyntheticEvent } from 'react';
import { useRef, useState } from 'react';

import {
  eyebrowClass,
  focusRingClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { settleBrowserAutosaves } from '../browser-autosaves.ts';
import { type ExportGrouping, exportGroupings } from '../export-period.ts';

type ExportState = 'failed' | 'idle' | 'settling' | 'submitted';
export type SettleAutosaves = () => Promise<void>;

const failureId = 'journal-export-failure';
const groupingLabels: Record<ExportGrouping, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};
const groupingDescriptions: Record<ExportGrouping, string> = {
  day: 'One Markdown file for each journal day, under days and its calendar year. This is the closest reading-copy layout to the journal’s day-by-day backup.',
  week: 'One Markdown file for each ISO 8601 week, under weeks and its ISO week-numbering year. ISO weeks run Monday to Sunday, and a week across New Year stays whole.',
  month:
    'One Markdown file for each calendar month, under months and its year.',
  year: 'One Markdown file for each calendar year at the top of the zip, without redundant year folders.',
};
const exportLabel: Record<ExportState, string> = {
  failed: 'Download the journal',
  idle: 'Download the journal',
  settling: 'Saving before download …',
  submitted: 'Download started',
};

const groupingDescriptionId = (grouping: ExportGrouping): string =>
  `export-${grouping}-description`;

type ExportControlProps = {
  readonly settleAutosaves?: SettleAutosaves;
};

export const ExportControl = ({
  settleAutosaves = settleBrowserAutosaves,
}: ExportControlProps) => {
  const [grouping, setGrouping] = useState<ExportGrouping>('day');
  const [submittedGrouping, setSubmittedGrouping] = useState<ExportGrouping>();
  const [state, setState] = useState<ExportState>('idle');
  const form: RefObject<HTMLFormElement | null> = useRef(null);
  const started: RefObject<boolean> = useRef(false);
  const settling = state === 'settling';
  const submitted = state === 'submitted';

  const submitAfterSettling = (
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ): Promise<void> => {
    event.preventDefault();
    if (started.current) {
      return Promise.resolve();
    }
    started.current = true;
    setSubmittedGrouping(grouping);
    setState('settling');
    return settleAutosaves().then(
      () => {
        setState('submitted');
        form.current?.submit();
      },
      () => {
        started.current = false;
        setSubmittedGrouping(undefined);
        setState('failed');
      },
    );
  };

  return (
    <form
      action="/archive/export"
      aria-busy={settling}
      method="post"
      onSubmit={submitAfterSettling}
      ref={form}
    >
      <p className={[readingMeasureClass, 'text-ink-muted text-lg'].join(' ')}>
        Every export contains the exact Postlude backup for recovery or import.
        Choose how its additional Markdown reading copies are gathered.
      </p>
      {submittedGrouping === undefined ? null : (
        <input name="grouping" type="hidden" value={submittedGrouping} />
      )}
      <fieldset className="mt-6" disabled={settling || submitted}>
        <legend className={[eyebrowClass, 'text-ink-faint'].join(' ')}>
          One reading-copy file per
        </legend>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          {exportGroupings.map((option) => (
            <div className="group contents" key={option}>
              <label className="flex items-center gap-2 text-ink-muted has-checked:text-ink">
                <input
                  aria-describedby={groupingDescriptionId(option)}
                  checked={grouping === option}
                  className={['accent-primary', focusRingClass].join(' ')}
                  name="grouping"
                  onChange={() => setGrouping(option)}
                  type="radio"
                  value={option}
                />
                {groupingLabels[option]}
              </label>
              <p
                className={[
                  readingMeasureClass,
                  'order-last hidden basis-full text-ink-faint group-has-[:checked]:block',
                ].join(' ')}
                id={groupingDescriptionId(option)}
              >
                {groupingDescriptions[option]}
              </p>
            </div>
          ))}
        </div>
      </fieldset>
      <button
        aria-busy={settling}
        aria-describedby={state === 'failed' ? failureId : undefined}
        aria-disabled={settling || submitted}
        className={[primaryButtonClass, 'mt-6'].join(' ')}
        type="submit"
      >
        {exportLabel[state]}
      </button>
      {state === 'failed' ? (
        <p
          className={[
            readingMeasureClass,
            'mt-4 border border-critical bg-critical-subtle px-3 py-2 text-ink text-sm',
          ].join(' ')}
          id={failureId}
          role="alert"
        >
          The latest journal changes could not be saved, so the download did not
          start. Check your connection and try the download again.
        </p>
      ) : null}
    </form>
  );
};
