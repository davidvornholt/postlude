import type { ArchiveView } from '../src/features/journal/services/archive-fns.ts';

export type ArchivePageFixtureConfig = {
  readonly selectedYear: number | undefined;
  readonly view: ArchiveView;
};

export type ArchivePageFixtureWindow = Window & {
  postludeArchivePageFixture: ArchivePageFixtureConfig;
};
