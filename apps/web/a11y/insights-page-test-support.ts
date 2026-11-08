import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import type { InsightsView } from '../src/features/journal/insights-view.ts';
import {
  allTimeOf,
  sampleInsightsMonth,
  sampleInsightsView,
  sampleInsightsWeek,
  sampleJournal,
} from '../src/features/journal/testing/insights-view.ts';
import type { FixtureAssets } from './hydrated-fixture-build.ts';
import { buildInsightsPageFixture } from './insights-page-fixture-build.ts';
import type {
  InsightsPageFixtureConfig,
  InsightsPageFixtureWindow,
} from './insights-page-fixture-contract.ts';

export const insightsFixtureToday = '2026-08-26';
export const insightsFixtureYear = 2026;
const pastYear = 2025;
/** Long enough that the invented journal opens two calendar years back. */
const sampleDays = 900;
const sampleSeed = 20_260_826;
const exportSettlementDelayMs = 1500;
const exportRetryDelayMs = 150;
const today = insightsFixtureToday;
export const insightsFixtureJournal = sampleJournal(
  today,
  sampleDays,
  sampleSeed,
);
const yearView = sampleInsightsView(
  insightsFixtureJournal,
  { kind: 'year', year: insightsFixtureYear },
  today,
);
const emptyView: InsightsView = sampleInsightsView(
  [],
  { kind: 'year', year: insightsFixtureYear },
  today,
);
const fixtureDocument = '**/__postlude-insights-fixture';

const openFixtureDocument = async (page: playwright.Page): Promise<void> => {
  await page.route(fixtureDocument, (route) =>
    route.fulfill({ body: '<!doctype html><html></html>', status: 200 }),
  );
  await page.goto('/__postlude-insights-fixture');
  await page.unroute(fixtureDocument);
};

const stored = { delayMs: 0, outcome: 'stored' } as const;

export const insightsFixtureConfigs = {
  empty: { exportSettlement: stored, view: emptyView },
  sourceOnly: {
    exportSettlement: stored,
    view: { ...emptyView, exportAvailable: true },
  },
  exportFailed: {
    exportSettlement: { delayMs: 0, outcome: 'failed' },
    view: yearView,
  },
  exportFailedOnce: {
    exportSettlement: { delayMs: exportRetryDelayMs, outcome: 'failed-once' },
    view: yearView,
  },
  exportDelayed: {
    exportSettlement: { delayMs: exportSettlementDelayMs, outcome: 'stored' },
    view: yearView,
  },
  exportPending: {
    exportSettlement: { delayMs: 0, outcome: 'pending' },
    view: yearView,
  },
  year: { exportSettlement: stored, view: yearView },
  pastYear: {
    exportSettlement: stored,
    view: sampleInsightsView(
      insightsFixtureJournal,
      { kind: 'year', year: pastYear },
      today,
    ),
  },
  allTime: {
    exportSettlement: stored,
    view: sampleInsightsView(
      insightsFixtureJournal,
      allTimeOf(insightsFixtureJournal, today),
      today,
    ),
  },
  month: { exportSettlement: stored, view: sampleInsightsMonth },
  week: { exportSettlement: stored, view: sampleInsightsWeek },
} satisfies Record<string, InsightsPageFixtureConfig>;

const assets = new Map<InsightsPageFixtureConfig, FixtureAssets>();

const assetsFor = async (
  config: InsightsPageFixtureConfig,
): Promise<FixtureAssets> => {
  const existing = assets.get(config);
  if (existing !== undefined) {
    return existing;
  }
  const built = await buildInsightsPageFixture(config);
  assets.set(config, built);
  return built;
};

const fixtureMarkup = (fixtureAssets: FixtureAssets): string =>
  `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Insights fixture</title></head><body><main id="insights-page-fixture">${fixtureAssets.markup}</main></body></html>`;

const expectPageHeading = async (page: playwright.Page): Promise<void> => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Insights',
  );
};

export const mountInsightsPage = async (
  page: playwright.Page,
  config: InsightsPageFixtureConfig,
): Promise<void> => {
  const fixtureAssets = await assetsFor(config);
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await openFixtureDocument(page);
  await page.setContent(fixtureMarkup(fixtureAssets));
  await page.addStyleTag({ content: fixtureAssets.styles });
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as InsightsPageFixtureWindow;
    fixtureWindow.postludeInsightsPageFixture = fixture;
  }, config);
  await page.addScriptTag({ content: fixtureAssets.script, type: 'module' });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(
      `The hydrated insights fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
  await expectPageHeading(page);
};

export const mountInsightsPageWithoutJavaScript = async (
  page: playwright.Page,
  config: InsightsPageFixtureConfig,
): Promise<void> => {
  const fixtureAssets = await assetsFor(config);
  await openFixtureDocument(page);
  await page.setContent(fixtureMarkup(fixtureAssets));
  await page.addStyleTag({ content: fixtureAssets.styles });
  await expectPageHeading(page);
};

/** Opens every fold, so the scan reaches what a reader would open. */
export const openEveryFold = async (page: playwright.Page): Promise<void> => {
  await page.locator('details').evaluateAll((folds) => {
    for (const fold of folds) {
      fold.setAttribute('open', '');
    }
  });
};

export const scanInsights = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};
