import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { buildDayPageFixture } from './day-page-fixture-build.ts';
import type {
  DayPageFixtureConfig,
  DayPageFixtureWindow,
  SaveOutcome,
} from './day-page-fixture-contract.ts';

const today = '2026-08-26';
const timestamp = '2026-08-26T20:00:00.000Z';
const textboxCount = 3;

const fixtureConfig = (
  saveOutcomes: ReadonlyArray<SaveOutcome>,
): DayPageFixtureConfig => ({
  entry: {
    date: today,
    journalMarkdown: '',
    journalWordCount: 0,
    scriptureMarkdown: '',
    scriptureWordCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  today,
  saveOutcomes,
});

const assets = await buildDayPageFixture(fixtureConfig(['stored']));

export const mountDayPage = async (
  page: playwright.Page,
  saveOutcomes: ReadonlyArray<SaveOutcome>,
): Promise<void> => {
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setContent(
    `<html lang="en"><head><title>Writing page fixture</title></head><body><main id="day-page-fixture">${assets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: assets.styles });
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as DayPageFixtureWindow;
    fixtureWindow.postludeDayPageFixture = fixture;
  }, fixtureConfig(saveOutcomes));
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

export const scan = async (page: playwright.Page): Promise<void> => {
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};

export const editAndLeave = async (
  page: playwright.Page,
  name: string,
  text: string,
): Promise<void> => {
  const field = page.getByRole('textbox', { name });
  await field.focus();
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
};
