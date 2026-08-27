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

import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { settleBrowserAutosaves } from '../browser-autosaves.ts';

type ExportState = 'failed' | 'idle' | 'settling' | 'submitted';
export type SettleAutosaves = () => Promise<void>;

const failureId = 'journal-export-failure';
const exportLabel: Record<ExportState, string> = {
  failed: 'Download the journal',
  idle: 'Download the journal',
  settling: 'Saving before download …',
  submitted: 'Download started',
};

type ExportControlProps = {
  readonly settleAutosaves?: SettleAutosaves;
};

export const ExportControl = ({
  settleAutosaves = settleBrowserAutosaves,
}: ExportControlProps) => {
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
    setState('settling');
    return settleAutosaves().then(
      () => {
        setState('submitted');
        form.current?.submit();
      },
      () => {
        started.current = false;
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
      <p className="max-w-prose text-ink-muted text-lg">
        Every day you have written, as markdown files in a zip — one file to a
        day, in a folder for each year. It opens in a text editor and in
        anything that reads markdown, with or without Postlude.
      </p>
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
          className="mt-4 max-w-prose border border-critical bg-critical-subtle px-3 py-2 text-ink text-sm"
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
