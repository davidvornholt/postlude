import type { InsightsView } from '../src/features/journal/insights-view.ts';

export type InsightsPageFixtureConfig = {
  readonly exportSettlement: {
    readonly delayMs: number;
    readonly outcome: 'failed' | 'failed-once' | 'pending' | 'stored';
  };
  readonly view: InsightsView;
};

export type InsightsPageFixtureWindow = Window & {
  postludeInsightsPageFixture: InsightsPageFixtureConfig;
};
