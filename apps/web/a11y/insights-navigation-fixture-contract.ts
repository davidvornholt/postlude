import type { InsightsView } from '../src/features/journal/insights-view.ts';
import type { InsightsQueryParams } from '../src/features/journal/schemas/insights-query.ts';
import type { FixtureEntry } from './day-page-fixture-contract.ts';

export type InsightsNavigationFixtureConfig = {
  readonly insightsReadOutcome: 'failed' | 'stored';
  readonly deferFirstInsightsRead: boolean;
  readonly entry: FixtureEntry;
  readonly saveOutcome: 'failed' | 'stored';
  readonly today: FixtureEntry['date'];
};

export type InsightsNavigationFixtureRuntime = {
  readonly readInsights: (query: InsightsQueryParams) => Promise<InsightsView>;
  readonly releaseInsightsRead: () => void;
};

export type InsightsNavigationFixtureWindow = Window & {
  postludeInsightsNavigationFixture: InsightsNavigationFixtureConfig;
  postludeInsightsNavigationRuntime?: InsightsNavigationFixtureRuntime;
};
