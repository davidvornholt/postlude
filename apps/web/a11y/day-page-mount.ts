/**
 * Mounting one hydrated day-page fixture: its server markup and styles, its
 * configuration, then its client bundle, which hydrates the markup.
 */

import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';
import { viewportContent } from '../src/shared/ui/viewport.ts';
import type { FixtureAssets } from './day-page-fixture-build.ts';
import type {
  DayPageFixtureConfig,
  DayPageFixtureWindow,
  SaveOutcome,
} from './day-page-fixture-contract.ts';

export const today = '2026-08-26';
const timestamp = '2026-08-26T20:00:00.000Z';
const textboxCount = 4;

export const fixtureConfig = (
  saveOutcomes: ReadonlyArray<SaveOutcome>,
  journalMarkdown: string,
  date = today,
): DayPageFixtureConfig => ({
  entry: {
    date,
    journalMarkdown,
    journalWordCount: 0,
    journalFirstUsedAt: null,
    scriptureMarkdown: '',
    scriptureWordCount: 0,
    revision: 1,
    scriptureFirstUsedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  today,
  saveOutcomes,
});

export const mountFixture = async (
  page: playwright.Page,
  config: DayPageFixtureConfig,
  assets: FixtureAssets,
): Promise<void> => {
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setContent(
    `<html lang="en"><head><meta name="viewport" content="${viewportContent}"><title>Writing page fixture</title></head><body><main id="day-page-fixture">${assets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: assets.styles });
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as DayPageFixtureWindow;
    fixtureWindow.postludeDayPageFixture = fixture;
  }, config);
  await page.addScriptTag({ content: assets.script, type: 'module' });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(
      `The hydrated fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
  await expect(page.getByRole('textbox')).toHaveCount(textboxCount);
};
