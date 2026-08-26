import type { FixtureEntry } from './day-page-fixture-contract.ts';

export type ArchiveNavigationFixtureConfig = {
  readonly entry: FixtureEntry;
  readonly saveOutcome: 'failed' | 'stored';
  readonly today: FixtureEntry['date'];
};

export type ArchiveNavigationFixtureWindow = Window & {
  postludeArchiveNavigationFixture: ArchiveNavigationFixtureConfig;
};
