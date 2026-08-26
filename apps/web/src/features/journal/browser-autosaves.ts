/** The one browser registry shared by writing surfaces and read-after-write navigation. */

import type { ConfirmedDraft } from './autosave.ts';
import type { AutosaveCoordinator, SaveDraft } from './autosave-coordinator.ts';
import { createAutosaveRegistry } from './autosave-registry.ts';
import { browserDraftRecovery } from './recoverable-draft.ts';

const registry = createAutosaveRegistry(browserDraftRecovery);

export const acquireBrowserAutosave = (
  stored: ConfirmedDraft,
  save: SaveDraft,
): AutosaveCoordinator => registry.acquire(stored, save);

export const settleBrowserAutosaves = (): Promise<void> => registry.settle();

export const readAfterSettlingBrowserAutosaves = async <A>(
  read: () => Promise<A>,
): Promise<A> => {
  await settleBrowserAutosaves();
  return read();
};
