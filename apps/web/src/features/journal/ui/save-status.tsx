/**
 * What the writer is told about the state of their words.
 *
 * The page saves itself, but successful autosaves are routine rather than an
 * event the interface should narrate. The visible line therefore stays on the
 * still promise "Autosave on", in the faintest ink, while a draft waits, saves
 * and settles; nothing on it moves while the words are being written. Only a
 * save that is still on its way after a few seconds changes the line, to say
 * so in the full ink, and a save that failed says why and what to do. The
 * exact state remains available to assistive technology without becoming a
 * live announcement on every pause in writing.
 *
 * Nothing here is said in colour alone. Each state is its own words, and the
 * one that needs attention adds a control rather than a hue.
 */

import { useEffect, useState } from 'react';

import { ActionAnchor, Button } from '#/shared/ui/action.tsx';

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import type { AutosaveFailure, SaveStatus } from '../autosave.ts';

const assistiveWording: Record<Exclude<SaveStatus, 'failed'>, string> = {
  saved: 'All changes saved',
  saving: 'Saving changes',
  unsaved: 'Changes waiting to save',
};

/** Long enough for a save on a slow connection; past it, the wait is news. */
const slowSaveMs = 4000;

/** Whether a save has been on its way for longer than a save should take. */
const useSlowSave = (saving: boolean): boolean => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!saving) {
      return;
    }
    const timer = setTimeout(() => setSlow(true), slowSaveMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [saving]);
  return saving && slow;
};

type SaveStatusProps = {
  readonly status: SaveStatus;
  readonly failure: AutosaveFailure | undefined;
  readonly onRetry: () => void;
};

const failureAction = (
  failure: AutosaveFailure | undefined,
  onRetry: () => void,
) => {
  if (failure?.kind === 'authentication') {
    return (
      <ActionAnchor variant="quiet" href="/login">
        Sign in again
      </ActionAnchor>
    );
  }
  return failure?.kind === 'network' ? (
    <Button variant="quiet" onClick={onRetry} type="button">
      Try again
    </Button>
  ) : null;
};

export const SaveStatusLine = ({
  status,
  failure,
  onRetry,
}: SaveStatusProps) => {
  const slow = useSlowSave(status === 'saving');
  if (status === 'failed') {
    return (
      <p
        className={[eyebrowClass, 'flex items-baseline gap-4'].join(' ')}
        data-save-status={status}
      >
        <span aria-live="polite" className="text-critical">
          {failure?.message ?? 'This entry could not be saved.'}
        </span>
        {failureAction(failure, onRetry)}
      </p>
    );
  }

  return (
    <p
      className={[eyebrowClass, slow ? 'text-ink' : 'text-ink-faint'].join(' ')}
      data-save-status={status}
    >
      <span aria-hidden="true">{slow ? 'Still saving …' : 'Autosave on'}</span>
      <span className="sr-only">{assistiveWording[status]}</span>
    </p>
  );
};
