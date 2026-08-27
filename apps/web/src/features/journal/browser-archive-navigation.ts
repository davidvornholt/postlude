/** A stable archive snapshot handed from the writing page to its route loader. */

import { readAfterSettlingBrowserAutosaves } from './browser-autosaves.ts';
import type { ArchiveQueryParams } from './schemas/archive-query.ts';
import { type ArchiveView, readArchiveFn } from './services/archive-fns.ts';

let preparedRollingArchive: ArchiveView | undefined;

const readArchive = (year: number | undefined): Promise<ArchiveView> =>
  readAfterSettlingBrowserAutosaves(() => readArchiveFn({ data: { year } }));

/** Prepares the main Archive link before its current writing page can unmount. */
export const prepareRollingArchiveNavigation = async (): Promise<void> => {
  preparedRollingArchive = await readArchive(undefined);
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
