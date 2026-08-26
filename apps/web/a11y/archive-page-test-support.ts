import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { activityWindow } from '../src/features/journal/activity.ts';
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
const journal = sampleJournal(today, sampleDays, sampleSeed);
const filledView = sampleArchiveView(journal, today);

export const archiveFixtureConfigs = {
  empty: {
    selectedYear: undefined,
    view: {
      today,
      window: activityWindow(today),
      days: [],
      years: [],
      journalStreak: { current: 0, longest: 0 },
      scriptureStreak: { current: 0, longest: 0 },
      totals: { daysWritten: 0, words: 0 },
      anniversaries: [],
    },
  },
  filled: { selectedYear: undefined, view: filledView },
  namedYear: {
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

export const scanArchive = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};
