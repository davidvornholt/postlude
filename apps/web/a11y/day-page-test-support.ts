import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';
import type { Anniversary } from '../src/features/journal/anniversary.ts';
import { markdownSemanticsFixture } from '../src/features/journal/ui/markdown-semantics.fixture.ts';
import { viewportContent } from '../src/shared/ui/viewport.ts';
import {
  buildDayPageFixture,
  type FixtureAssets,
} from './day-page-fixture-build.ts';
import type {
  DayPageFixtureConfig,
  DayPageFixtureWindow,
  SaveOutcome,
} from './day-page-fixture-contract.ts';

const today = '2026-08-26';
const timestamp = '2026-08-26T20:00:00.000Z';
const textboxCount = 4;
const longMemoryWordRepeats = 160;

const fixtureConfig = (
  saveOutcomes: ReadonlyArray<SaveOutcome>,
  journalMarkdown: string,
  anniversaries: ReadonlyArray<Anniversary>,
  date = today,
): DayPageFixtureConfig => ({
  anniversaries,
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

const emptyConfig = fixtureConfig(['stored'], '', []);
const datedConfig = fixtureConfig(['stored'], '', [], '2026-08-25');
const memoryConfig = fixtureConfig(['stored'], '', [
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
]);

const emptyAssets = await buildDayPageFixture(emptyConfig);
const datedAssets = await buildDayPageFixture(datedConfig);
const memoryAssets = await buildDayPageFixture(memoryConfig);
const semanticAssets = await buildDayPageFixture(
  fixtureConfig(['stored'], markdownSemanticsFixture, []),
);

const mountFixture = async (
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

export const mountDayPage = (
  page: playwright.Page,
  saveOutcomes: ReadonlyArray<SaveOutcome>,
): Promise<void> =>
  mountFixture(page, fixtureConfig(saveOutcomes, '', []), emptyAssets);

export const mountDatedDayPage = (page: playwright.Page): Promise<void> =>
  mountFixture(page, datedConfig, datedAssets);

export const mountMemoryDayPage = (page: playwright.Page): Promise<void> =>
  mountFixture(page, memoryConfig, memoryAssets);

export const mountSemanticDayPage = (page: playwright.Page): Promise<void> =>
  mountFixture(
    page,
    fixtureConfig(['stored'], markdownSemanticsFixture, []),
    semanticAssets,
  );

/** Server markup and styles, with no client bundle attached. */
export const mountUnhydratedDayPage = async (
  page: playwright.Page,
): Promise<void> => {
  await page.setContent(
    `<html lang="en"><head><base href="http://127.0.0.1:3100/"><meta name="viewport" content="${viewportContent}"><title>Writing page fixture</title></head><body><main id="day-page-fixture">${emptyAssets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: emptyAssets.styles });
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
