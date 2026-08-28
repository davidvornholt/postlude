import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { buildReadingPageFixture } from './reading-page-fixture-build.ts';
import type {
  ReadingPageFixtureConfig,
  ReadingPageFixtureWindow,
} from './reading-page-fixture-contract.ts';

const today = '2026-08-26';
const longMemoryWordRepeats = 160;

export const readingPageFixtureConfigs = {
  calendar: {
    kind: 'calendar',
    requestedDay: '2026-08-19',
    view: {
      days: [
        {
          date: '2026-08-19',
          hasScriptureReference: false,
          revision: 2,
          snippet: 'A quiet kind of progress.',
          words: 120,
        },
      ],
      earliest: '2025-03-02',
      month: '2026-08',
      today,
    },
  },
  onThisDay: {
    kind: 'on-this-day',
    view: {
      anniversaries: [
        {
          date: '2025-08-26',
          yearsAgo: 1,
          words: 210,
          snippet: 'Moved the desk under the window.',
        },
        {
          date: '2024-08-26',
          yearsAgo: 2,
          words: 89,
          snippet: `A-long-unbroken-memory-${'word'.repeat(longMemoryWordRepeats)}`,
        },
      ],
      date: today,
      today,
    },
  },
} satisfies Record<string, ReadingPageFixtureConfig>;

const assets = new Map<
  ReadingPageFixtureConfig,
  Awaited<ReturnType<typeof buildReadingPageFixture>>
>();

export const mountReadingPage = async (
  page: playwright.Page,
  config: ReadingPageFixtureConfig,
): Promise<void> => {
  const fixtureAssets =
    assets.get(config) ?? (await buildReadingPageFixture(config));
  assets.set(config, fixtureAssets);
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setContent(
    `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reading page fixture</title></head><body><main id="reading-page-fixture">${fixtureAssets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: fixtureAssets.styles });
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as ReadingPageFixtureWindow;
    fixtureWindow.postludeReadingPageFixture = fixture;
  }, config);
  await page.addScriptTag({ content: fixtureAssets.script, type: 'module' });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor();
  } catch (error) {
    throw new Error(
      `The hydrated reading-page fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
};

export const scanReadingPage = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};
