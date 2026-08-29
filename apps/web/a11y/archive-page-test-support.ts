import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { activityWindow, dayWords } from '../src/features/journal/activity.ts';
import type { ArchiveView } from '../src/features/journal/services/archive-fns.ts';
import {
  sampleArchiveView,
  sampleJournal,
} from '../src/features/journal/testing/archive-view.ts';
import { buildArchivePageFixture } from './archive-page-fixture-build.ts';
import type {
  ArchivePageFixtureConfig,
  ArchivePageFixtureWindow,
} from './archive-page-fixture-contract.ts';
import type { FixtureAssets } from './hydrated-fixture-build.ts';

const today = '2026-08-26';
const namedYear = 2024;
const sampleDays = 400;
const sampleSeed = 20_260_826;
const exportSettlementDelayMs = 1500;
const journal = sampleJournal(today, sampleDays, sampleSeed);
const filledView = sampleArchiveView(journal, today);
export const archiveFixtureHistoryAverage = Math.round(
  journal.reduce((total, day) => total + dayWords(day), 0) / journal.length,
);
export const archiveFixtureHistoryStart = journal[0]?.date;
const emptyView: ArchiveView = {
  today,
  exportAvailable: false,
  window: activityWindow(today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
};
const fixtureDocument = '**/__postlude-archive-fixture';

const openFixtureDocument = async (page: playwright.Page): Promise<void> => {
  await page.route(fixtureDocument, (route) =>
    route.fulfill({ body: '<!doctype html><html></html>', status: 200 }),
  );
  await page.goto('/__postlude-archive-fixture');
  await page.unroute(fixtureDocument);
};

export const archiveFixtureConfigs = {
  empty: {
    exportSettlement: { delayMs: 0, outcome: 'stored' },
    selectedYear: undefined,
    view: emptyView,
  },
  sourceOnly: {
    exportSettlement: { delayMs: 0, outcome: 'stored' },
    selectedYear: undefined,
    view: { ...emptyView, exportAvailable: true },
  },
  exportFailed: {
    exportSettlement: { delayMs: 0, outcome: 'failed' },
    selectedYear: undefined,
    view: filledView,
  },
  exportFailedOnce: {
    exportSettlement: { delayMs: 150, outcome: 'failed-once' },
    selectedYear: undefined,
    view: filledView,
  },
  exportDelayed: {
    exportSettlement: {
      delayMs: exportSettlementDelayMs,
      outcome: 'stored',
    },
    selectedYear: undefined,
    view: filledView,
  },
  exportPending: {
    exportSettlement: { delayMs: 0, outcome: 'pending' },
    selectedYear: undefined,
    view: filledView,
  },
  filled: {
    exportSettlement: { delayMs: 0, outcome: 'stored' },
    selectedYear: undefined,
    view: filledView,
  },
  namedYear: {
    exportSettlement: { delayMs: 0, outcome: 'stored' },
    selectedYear: namedYear,
    view: {
      ...filledView,
      days: [],
      window: activityWindow(today, namedYear),
    },
  },
} satisfies Record<string, ArchivePageFixtureConfig>;

const assets = new Map<ArchivePageFixtureConfig, FixtureAssets>();

const assetsFor = async (
  config: ArchivePageFixtureConfig,
): Promise<FixtureAssets> => {
  const existing = assets.get(config);
  if (existing !== undefined) {
    return existing;
  }
  const built = await buildArchivePageFixture(config);
  assets.set(config, built);
  return built;
};

export const mountArchivePage = async (
  page: playwright.Page,
  config: ArchivePageFixtureConfig,
): Promise<void> => {
  const fixtureAssets = await assetsFor(config);
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await openFixtureDocument(page);
  await page.setContent(
    `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Archive fixture</title></head><body><main id="archive-page-fixture">${fixtureAssets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: fixtureAssets.styles });
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as ArchivePageFixtureWindow;
    fixtureWindow.postludeArchivePageFixture = fixture;
  }, config);
  await page.addScriptTag({ content: fixtureAssets.script, type: 'module' });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(
      `The hydrated archive fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
};

export const mountArchivePageWithoutJavaScript = async (
  page: playwright.Page,
  config: ArchivePageFixtureConfig,
): Promise<void> => {
  const fixtureAssets = await assetsFor(config);
  await openFixtureDocument(page);
  await page.setContent(
    `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Archive fixture</title></head><body><main id="archive-page-fixture">${fixtureAssets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: fixtureAssets.styles });
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
};

export const scanArchive = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};
