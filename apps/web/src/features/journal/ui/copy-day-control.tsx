/** Copies the complete current draft without adding controls to each section. */

import { useRef, useState } from 'react';

import { iconButtonClass } from '#/shared/ui/form-classes.ts';
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

const CopyIcon = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <path d="M8 8h11v11H8zM5 16H4V4h12v1" stroke="currentColor" />
  </svg>
);

const CopiedIcon = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <path d="m5 12 4 4L19 6" stroke="currentColor" />
  </svg>
);

export const CopyDayControl = ({
  day,
}: {
  readonly day: CopyableJournalDay;
}) => {
  const [result, setResult] = useState<{
    readonly day: CopyableJournalDay;
    readonly state: CopyState;
  }>({ day, state: 'idle' });
  const [copying, setCopying] = useState(false);
  const nextRequestId = useRef(0);
  const activeRequest = useRef<number | null>(null);
  let state: CopyState = 'idle';
  if (copying) {
    state = 'copying';
  } else if (result.day === day) {
    const { state: resultState } = result;
    state = resultState;
  }

  const copy = () => {
    if (activeRequest.current !== null) {
      return;
    }

    const requestId = nextRequestId.current + 1;
    nextRequestId.current = requestId;
    activeRequest.current = requestId;
    setCopying(true);
    setResult({ day, state: 'copying' });

    const settle = (nextState: 'failed' | 'succeeded') => {
      if (activeRequest.current !== requestId) {
        return;
      }
      activeRequest.current = null;
      setCopying(false);
      setResult({ day, state: nextState });
    };

    try {
      writeClipboardText(dayCopyMarkdown(day)).then(
        () => settle('succeeded'),
        () => settle('failed'),
      );
    } catch {
      settle('failed');
    }
  };

  return (
    <div className="flex min-h-11 items-center gap-3">
      <button
        aria-label="Copy day as Markdown"
        aria-busy={copying}
        aria-disabled={copying}
        className={iconButtonClass}
        data-copy-state={state}
        onClick={copy}
        title="Copy day as Markdown"
        type="button"
      >
        {state === 'succeeded' ? <CopiedIcon /> : <CopyIcon />}
      </button>
      <span
        aria-atomic="true"
        aria-live="polite"
        className={state === 'failed' ? 'text-critical text-sm' : 'sr-only'}
      >
        {statusText[state]}
      </span>
    </div>
  );
};
