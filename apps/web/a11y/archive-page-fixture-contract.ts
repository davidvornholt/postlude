import type { ArchiveView } from '../src/features/journal/services/archive-fns.ts';

// The fixture never presses the download control; its port must remain inert.
export const neverDownloads = () => new Promise<never>(() => undefined);

export type ArchivePageFixtureConfig = {
  readonly selectedYear: number | undefined;
  readonly view: ArchiveView;
};

export type ArchivePageFixtureWindow = Window & {
  postludeArchivePageFixture: ArchivePageFixtureConfig;
};
