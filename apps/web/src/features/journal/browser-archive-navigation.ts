/** A stable archive snapshot handed from the writing page to its route loader. */

import { AutosaveSettlementError } from './autosave-registry.ts';
import {
  readAfterSettlingBrowserAutosaves,
  settleBrowserAutosaves,
} from './browser-autosaves.ts';
import type { ArchiveQueryParams } from './schemas/archive-query.ts';
import type { ArchiveView } from './services/archive-fns.ts';

let preparedRollingArchive: ArchiveView | undefined;
let archiveFunctions:
  | Promise<typeof import('./services/archive-fns.ts')>
  | undefined;

const loadArchiveFunctions = () => {
  archiveFunctions ??= import('./services/archive-fns.ts');
  return archiveFunctions;
};

/** Warms the split archive boundary without reading private journal data. */
export const preloadArchiveNavigation = (): void => {
  loadArchiveFunctions().catch(() => {
    archiveFunctions = undefined;
  });
};

const readArchive = (year: number | undefined): Promise<ArchiveView> =>
  readAfterSettlingBrowserAutosaves(async () => {
    const { readArchiveFn } = await loadArchiveFunctions();
    return readArchiveFn({ data: { year } });
  });

/** Prepares the main Archive link before its current writing page can unmount. */
export const prepareRollingArchiveNavigation = async (): Promise<void> => {
  try {
    preparedRollingArchive = await readArchive(undefined);
  } catch (error) {
    if (error instanceof AutosaveSettlementError) {
      throw error;
    }
    preparedRollingArchive = undefined;
    // The route loader owns read failures. Settle once more first, because an
    // edit may have arrived while the failed pre-navigation read was pending.
    await settleBrowserAutosaves();
  }
};

export const discardPreparedArchiveNavigation = (): void => {
  preparedRollingArchive = undefined;
};

/** Consumes a prepared rolling view once; direct and named-year loads read now. */
export const readArchiveRoute = ({
  year,
}: ArchiveQueryParams): Promise<ArchiveView> => {
  const prepared = preparedRollingArchive;
  preparedRollingArchive = undefined;
  return year === undefined && prepared !== undefined
    ? Promise.resolve(prepared)
    : readArchive(year);
};
