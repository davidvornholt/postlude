/** The one browser registry shared by writing surfaces and read-after-write navigation. */

import type { ConfirmedDraft } from './autosave.ts';
import type { AutosaveCoordinator, SaveDraft } from './autosave-coordinator.ts';
import {
  AutosaveSettlementError,
  createAutosaveRegistry,
} from './autosave-registry.ts';
import type { JournalDate } from './journal-day.ts';
import { browserDraftRecovery } from './recoverable-draft.ts';

const registry = createAutosaveRegistry(browserDraftRecovery);

export const acquireBrowserAutosave = (
  stored: ConfirmedDraft,
  save: SaveDraft,
): AutosaveCoordinator => registry.acquire(stored, save);

export const settleBrowserAutosaves = (): Promise<void> => registry.settle();

export type SettledNavigationResult =
  | { readonly _tag: 'navigated' }
  | { readonly _tag: 'blocked'; readonly date: JournalDate };

export const navigateAfterAutosavesSettle = async (
  settle: () => Promise<void>,
  navigate: () => Promise<void>,
): Promise<SettledNavigationResult> => {
  try {
    await settle();
  } catch (error) {
    if (error instanceof AutosaveSettlementError) {
      return { _tag: 'blocked', date: error.date };
    }
    throw error;
  }
  await navigate();
  return { _tag: 'navigated' };
};

/** Leaves the current page in place when its forced save cannot be confirmed. */
export const navigateAfterSettlingBrowserAutosaves = (
  navigate: () => Promise<void>,
): Promise<SettledNavigationResult> =>
  navigateAfterAutosavesSettle(settleBrowserAutosaves, navigate);

export const readAfterSettlingBrowserAutosaves = async <A>(
  read: () => Promise<A>,
): Promise<A> => {
  await settleBrowserAutosaves();
  return read();
};
