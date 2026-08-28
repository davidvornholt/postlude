/**
 * What the writer is told about the state of their words.
 *
 * The page saves itself, but successful autosaves are routine rather than an
 * event the interface should narrate. The visible line therefore stays on the
 * stable promise "Autosave on" while a draft waits, saves, and settles. The
 * exact state remains available to assistive technology without becoming a
 * live announcement on every pause in writing.
 *
 * Nothing here is said in colour alone. Each state is its own words, and the
 * one that needs attention adds a control rather than a hue.
 */

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import type { AutosaveFailure, SaveStatus } from '../autosave.ts';

const assistiveWording: Record<Exclude<SaveStatus, 'failed'>, string> = {
  saved: 'All changes saved',
  saving: 'Saving changes',
  unsaved: 'Changes waiting to save',
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
      <a className={quietButtonClass} href="/login">
        Sign in again
      </a>
    );
  }
  return failure?.kind === 'network' ? (
    <button className={quietButtonClass} onClick={onRetry} type="button">
      Try again
    </button>
  ) : null;
};

export const SaveStatusLine = ({
  status,
  failure,
  onRetry,
}: SaveStatusProps) => {
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
      className={[eyebrowClass, 'text-ink-faint'].join(' ')}
      data-save-status={status}
    >
      <span aria-hidden="true">Autosave on</span>
      <span className="sr-only">{assistiveWording[status]}</span>
    </p>
  );
};
