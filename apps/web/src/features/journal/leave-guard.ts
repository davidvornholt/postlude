/**
 * Asks before the tab closes while any journal day holds writing the server
 * has not confirmed.
 *
 * The registry keeps such a day's coordinator after its page unmounts, so the
 * warning belongs to the tab rather than to the writing page. A coordinator
 * keeps the tab's recovery copy exactly while its day is unsaved, so the guard
 * follows the same calls. The listener exists only while a day needs it,
 * because a `beforeunload` listener can keep a browser from caching the page
 * for Back and Forward.
 */

import type { DraftRecovery } from './recoverable-draft.ts';

type LeaveTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

const confirmLeaving = (event: Event): void => {
  event.preventDefault();
};

/** Returns a wrapper that makes each day's recovery calls guard the tab. */
export const createLeaveGuard = (
  target: () => LeaveTarget,
): ((recovery: DraftRecovery) => DraftRecovery) => {
  const unsavedDays = new Set<string>();
  const mark = (date: string, unsaved: boolean): void => {
    const wasGuarded = unsavedDays.size > 0;
    if (unsaved) {
      unsavedDays.add(date);
    } else {
      unsavedDays.delete(date);
    }
    const guarded = unsavedDays.size > 0;
    if (guarded && !wasGuarded) {
      target().addEventListener('beforeunload', confirmLeaving);
    }
    if (wasGuarded && !guarded) {
      target().removeEventListener('beforeunload', confirmLeaving);
    }
  };
  return (recovery) => ({
    read: recovery.read,
    retain: (draft) => {
      recovery.retain(draft);
      mark(draft.date, true);
    },
    clear: (date) => {
      recovery.clear(date);
      mark(date, false);
    },
  });
};
