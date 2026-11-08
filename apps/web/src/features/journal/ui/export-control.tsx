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
import { Button } from '#/shared/ui/action.tsx';
import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import {
  SegmentedTrack,
  SegmentRadio,
} from '#/shared/ui/segmented-control.tsx';
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

const groupingInputId = (grouping: ExportGrouping): string =>
  `export-${grouping}`;

// Each grouping's description shows while its radio is checked, read from the
// radio itself so it follows the choice before the script runs too. Written
// out in full so the stylesheet generator can find each class.
//
// All four lie in one grid cell and the others are only made invisible, so
// the cell is always as tall as the longest description wraps to at the
// current width, and switching never moves the button below.
const descriptionShown: Record<ExportGrouping, string> = {
  day: 'group-has-[#export-day:checked]:visible',
  week: 'group-has-[#export-week:checked]:visible',
  month: 'group-has-[#export-month:checked]:visible',
  year: 'group-has-[#export-year:checked]:visible',
};

type ExportControlProps = {
  readonly settleAutosaves?: SettleAutosaves;
};

export const ExportControl = ({
  settleAutosaves = settleBrowserAutosaves,
}: ExportControlProps) => {
  const [grouping, setGrouping] = useState<ExportGrouping>('day');
  const [submittedGrouping, setSubmittedGrouping] = useState<ExportGrouping>();
  const [state, setState] = useState<ExportState>('idle');
  const formRef: RefObject<HTMLFormElement | null> = useRef(null);
  const startedRef: RefObject<boolean> = useRef(false);
  const settling = state === 'settling';
  const submitted = state === 'submitted';

  const submitAfterSettling = (
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ): Promise<void> => {
    event.preventDefault();
    if (startedRef.current) {
      return Promise.resolve();
    }
    startedRef.current = true;
    setSubmittedGrouping(grouping);
    setState('settling');
    return settleAutosaves().then(
      () => {
        setState('submitted');
        formRef.current?.submit();
      },
      () => {
        startedRef.current = false;
        setSubmittedGrouping(undefined);
        setState('failed');
      },
    );
  };

  return (
    <form
      action="/insights/export"
      aria-busy={settling}
      method="post"
      onSubmit={submitAfterSettling}
      ref={formRef}
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
        <div className="group mt-3">
          <SegmentedTrack
            className="w-full max-w-md"
            count={exportGroupings.length}
          >
            {exportGroupings.map((option) => (
              <SegmentRadio
                aria-describedby={groupingDescriptionId(option)}
                checked={grouping === option}
                id={groupingInputId(option)}
                key={option}
                name="grouping"
                onChange={() => setGrouping(option)}
                value={option}
              >
                {groupingLabels[option]}
              </SegmentRadio>
            ))}
          </SegmentedTrack>
          <div className="mt-3 grid">
            {exportGroupings.map((option) => (
              <p
                className={[
                  readingMeasureClass,
                  'invisible col-start-1 row-start-1 text-ink-faint',
                  descriptionShown[option],
                ].join(' ')}
                id={groupingDescriptionId(option)}
                key={option}
              >
                {groupingDescriptions[option]}
              </p>
            ))}
          </div>
        </div>
      </fieldset>
      <Button
        aria-busy={settling}
        aria-describedby={state === 'failed' ? failureId : undefined}
        aria-disabled={settling || submitted}
        variant="primary"
        className="mt-6"
        type="submit"
      >
        {exportLabel[state]}
      </Button>
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
