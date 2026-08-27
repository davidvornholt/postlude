import type { ArchiveView } from '../src/features/journal/services/archive-fns.ts';
import type { FixtureEntry } from './day-page-fixture-contract.ts';

export type ArchiveNavigationFixtureConfig = {
  readonly archiveReadOutcome: 'failed' | 'stored';
  readonly deferFirstArchiveRead: boolean;
  readonly entry: FixtureEntry;
  readonly saveOutcome: 'failed' | 'stored';
  readonly today: FixtureEntry['date'];
};

export type ArchiveNavigationFixtureRuntime = {
  readonly readArchive: () => Promise<ArchiveView>;
  readonly releaseArchiveRead: () => void;
};

export type ArchiveNavigationFixtureWindow = Window & {
  postludeArchiveNavigationFixture: ArchiveNavigationFixtureConfig;
  postludeArchiveNavigationRuntime?: ArchiveNavigationFixtureRuntime;
};
