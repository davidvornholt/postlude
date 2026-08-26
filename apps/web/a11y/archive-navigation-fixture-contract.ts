import type { FixtureEntry } from './day-page-fixture-contract.ts';

export type ArchiveNavigationFixtureConfig = {
  readonly entry: FixtureEntry;
  readonly today: FixtureEntry['date'];
};

export type ArchiveNavigationFixtureWindow = Window & {
  postludeArchiveNavigationFixture: ArchiveNavigationFixtureConfig;
};
