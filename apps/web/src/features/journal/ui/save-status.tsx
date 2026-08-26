/**
 * What the writer is told about the state of their words.
 *
 * The page saves itself, so this line is the only evidence that it does. It is
 * a live region rather than a static label: the change from "Saving" to
 * "Saved" is the whole message, and a reader who is not looking at this corner
 * of the screen — or not looking at the screen — would otherwise never get it.
 *
 * Nothing here is said in colour alone. Each state is its own words, and the
 * one that needs attention adds a control rather than a hue.
 */

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import type { SaveStatus } from '../autosave.ts';

const wording: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving …',
  unsaved: 'Not saved yet',
  failed: 'Could not save',
};

type SaveStatusProps = {
  readonly status: SaveStatus;
  readonly onRetry: () => void;
};

export const SaveStatusLine = ({ status, onRetry }: SaveStatusProps) => (
  <p className={[eyebrowClass, 'flex items-baseline gap-4'].join(' ')}>
    {/*
      `aria-live` sits on an element that is in the document from the start.
      A region that appears at the moment it has something to say is announced
      by nothing, because there was no region to watch when the text arrived.
    */}
    <span
      aria-live="polite"
      className={status === 'failed' ? 'text-critical' : 'text-ink-faint'}
    >
      {wording[status]}
    </span>
    {status === 'failed' ? (
      <button className={quietButtonClass} onClick={onRetry} type="button">
        Try again
      </button>
    ) : null}
  </p>
);
