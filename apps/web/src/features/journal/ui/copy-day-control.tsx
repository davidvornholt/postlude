/** Copies the complete current draft without adding controls to each section. */

import { useState } from 'react';

import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import {
  type CopyableJournalDay,
  dayCopyMarkdown,
} from '../day-copy-markdown.ts';

type CopyState = 'copying' | 'failed' | 'idle' | 'succeeded';

const statusText: Record<CopyState, string> = {
  copying: 'Copying …',
  failed: 'Could not copy. Try again.',
  idle: '',
  succeeded: 'Day copied as Markdown.',
};

const writeClipboardText = (markdown: string): Promise<void> => {
  const { clipboard } = globalThis.navigator;
  return clipboard === undefined
    ? Promise.reject(new Error('The Clipboard API is unavailable.'))
    : clipboard.writeText(markdown);
};

export const CopyDayControl = ({
  day,
}: {
  readonly day: CopyableJournalDay;
}) => {
  const [result, setResult] = useState<{
    readonly day: CopyableJournalDay;
    readonly state: CopyState;
  }>({ day, state: 'idle' });
  const state = result.day === day ? result.state : 'idle';
  const copying = state === 'copying';

  const copy = () => {
    setResult({ day, state: 'copying' });
    writeClipboardText(dayCopyMarkdown(day)).then(
      () => setResult({ day, state: 'succeeded' }),
      () => setResult({ day, state: 'failed' }),
    );
  };

  return (
    <div className="flex min-h-5 items-start gap-x-4 sm:flex-row-reverse">
      <button
        aria-busy={copying}
        className={quietButtonClass}
        disabled={copying}
        onClick={copy}
        type="button"
      >
        Copy day
      </button>
      <span
        aria-atomic="true"
        aria-live="polite"
        className="text-ink-faint text-sm"
      >
        {statusText[state]}
      </span>
    </div>
  );
};
